const fs = require('fs');

/**
 * @property {string} name
 * @property {object} parameters
 * @property {string} value
 */
class ICalendarProperty {
  /**
   * @param {string} name
   * @param {object} parameters
   * @param {string} value
   */
  constructor(name, parameters, value) {
    if (name == '') {
      throw new Error(
          'Constructed with invalid property name',
      );
    }
    this.name = name;
    this.parameters = parameters;
    this.value = value;
  }

  /**
   * @param {string} str
   * @param {integer} line
   * @return {ICalendarProperty}
   */
  static fromString(str, line = 0) {
    // One-based numbering for errors!
    line++;

    let name = '';
    let parameterKey = '';
    let parameterValues = [];
    const parameters = {};
    let value = '';

    let escaped = false;
    let quoted = false;
    let mode = 'name';
    let scratch = '';

    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(i);
      if (escaped) {
        switch (char) {
          case 'n':
          case 'N':
            scratch += '\n';
            break;
          case '\\':
          case ',':
          case ';':
          case ':':
          case '=':
          case '"':
            scratch += char;
            break;
          default:
            throw new Error(`Unrecognized escape sequence (${line}:${i})`);
        }
        escaped = false;
      } else if (mode == 'value') {
        value += char;
      } else if (quoted) {
        switch (char) {
          case '"':
            quoted = false;
            break;
          case '\\':
            escaped = true;
            break;
          default:
            scratch += char;
            break;
        }
      } else {
        switch (char) {
          case '\\':
            escaped = true;
            break;
          case '"':
            quoted = true;
            break;
          case ';':
            switch (mode) {
              case 'name':
                name = scratch;
                mode = 'parameterKey';
                break;
              case 'parameterKey':
                throw new Error(`Param key without value (${line}:${i})`);
              case 'parameterValue':
                parameterValues.push(scratch);
                parameters[parameterKey] = parameterValues;
                parameterValues = [];
                mode = 'parameterKey';
                break;
            }
            scratch = '';
            break;
          case ':':
            switch (mode) {
              case 'name':
                name = scratch;
                mode = 'value';
                break;
              case 'parameterKey':
                throw new Error(`Param key without value (${line}:${i})`);
              case 'parameterValue':
                parameterValues.push(scratch);
                parameters[parameterKey] = parameterValues;
                parameterValues = [];
                mode = 'value';
                break;
            }
            scratch = '';
            break;
          case ',':
            switch (mode) {
              case 'name':
                throw new Error(`Unexpected "," in name (${line}:${i})`);
              case 'parameterKey':
                throw new Error(`Unexpected "," in param key (${line}:${i})`);
              case 'parameterValue':
                parameterValues.push(scratch);
                break;
            }
            scratch = '';
            break;
          case '=':
            switch (mode) {
              case 'name':
                throw new Error(`Unexpected "=" in name (${line}:${i})`);
              case 'parameterKey':
                parameterKey = scratch;
                mode = 'parameterValue';
                break;
              case 'parameterValue':
                throw new Error(`Unescaped "=" in param value (${line}:${i})`);
            }
            scratch = '';
            break;
          default:
            scratch += char;
        }
      }
    }

    switch (mode) {
      case 'name':
        throw new Error(`Unexpected EOL in name (${line}:${i})`);
      case 'parameterKey':
        throw new Error(`Unexpected EOL in param key (${line}:${i})`);
      case 'parameterValue':
        throw new Error(`Unexpected EOL in param value (${line}:${i})`);
    }

    if (name == '') {
      throw new Error(`Invalid property name (${line}:${i})`);
    }

    const result = new ICalendarProperty(
        name.toUpperCase(),
        parameters,
        value,
    );

    const checkStr = result.toString();

    if (checkStr != str) {
      throw new Error(
          `Failed round-trip test, original "${str}", result "${checkStr}"`,
      );
    }

    return result;
  }

  /**
   * @return {string}
   */
  toString() {
    if (!this.name.match(/^[A-Za-z0-9-]+$/)) {
      throw new Error(`Invalid property name: ${this.name}`);
    }

    let result = this.name;

    for (const key in this.parameters) {
      if (Object.prototype.hasOwnProperty.call(this.parameters, key)) {
        const value = this.parameters[key];

        if (!key.match(/^[A-Za-z0-9-]+$/)) {
          throw new Error(`Invalid param key: ${key}`);
        }

        result += ';' + key + '=' + value;
      }
    }

    result += ':' + this.value
        .replace(/\n/g, '\\n')
        .replace(/[,;']/g, '\\$&');

    return result;
  }
}

/**
 * @property {string} name
 * @property {array} properties
 * @property {array} components
 */
class ICalendarComponent {
  /**
   * @param {string} name
   * @param {array} properties
   * @param {array} components
   */
  constructor(name, properties, components) {
    this.name = name;
    this.properties = properties;
    this.components = components;
  }

  /**
   * @param {array} arr
   * @return {ICalendarComponent}
   */
  static fromArray(arr) {
    const result = this.fromArrayInternal(arr, 0);
    return result[0];
  }

  /**
   * @param {array} arr
   * @param {integer} offset
   * @return {array}
   */
  static fromArrayInternal(arr, offset) {
    const componentPattern = /^(BEGIN|END):([A-Z0-9a-z-]+)$/;

    const match = arr[offset].match(componentPattern);
    if (!match || match[1] != 'BEGIN') {
      throw new Error('Missing expected BEGIN on line ' + (offset + 1));
    }

    const name = match[2];
    const properties = [];
    const components = [];

    for (let i = offset + 1; i < arr.length; i++) {
      const match = arr[i].match(componentPattern);

      if (!match) {
        properties.push(ICalendarProperty.fromString(arr[i], i));
      } else if (match[1] == 'BEGIN') {
        const result = ICalendarComponent.fromArrayInternal(arr, i);
        components.push(result[0]);
        i = result[1];
      } else if (match[1] == 'END' && match[2] == name) {
        return [
          new ICalendarComponent(
              name,
              properties,
              components,
          ),
          i,
        ];
      } else {
        throw new Error('Expected END:' + name + ' on line ' + (i + 1));
      }
    }

    // TODO: this is a bit weird, clean up
    return [
      new ICalendarComponent(
          name,
          properties,
          components,
      ),
      -1,
    ];
  }

  /**
   * @param {Buffer} buf
   * @return {ICalendar}
   */
  static fromBuffer(buf) {
    const data = [];
    let field = Buffer.alloc(0);
    let start = 0;

    for (
      let offset = buf.indexOf('\r\n');
      offset != -1;
      offset = buf.indexOf('\r\n', start)
    ) {
      // ASCII space or tab
      if (buf[start] == 0x20 || buf[start] == 0x09) {
        field = Buffer.concat([field, buf.slice(start + 1, offset)]);
      } else {
        if (field.length > 0) {
          data.push(field.toString('utf-8'));
        }
        field = buf.slice(start, offset);
      }

      start = offset + 2;
    }

    if (start < buf.length) {
      data.push(field.toString('utf-8'));
    }

    return ICalendarComponent.fromArray(data);
  }

  /**
   * @param {string} str
   * @return {ICalendar}
   */
  static fromString(str) {
    return ICalendarComponent.fromBuffer(Buffer.from(str));
  }

  /**
   * @return {array}
   */
  toArray() {
    const result = [];

    result.push(`BEGIN:${this.name}`);

    for (let i = 0; i < this.properties.length; i++) {
      result.push(this.properties[i].toString());
    }

    for (let i = 0; i < this.components.length; i++) {
      result.push(...this.components[i].toArray());
    }

    result.push(`END:${this.name}`);

    return result;
  }

  /**
   * @return {string}
   */
  toString() {
    const arr = this.toArray();
    let result = '';

    for (let i = 0; i < arr.length; i++) {
      let element = arr[i];

      while (element.length > 75) {
        result += element.slice(0, 75) + '\r\n';
        element = ' ' + element.slice(75);
      }

      result += element + '\r\n';
    }

    return result;
  }
}

/*
const property = new ICalendarProperty(
    'REFRESH-INTERVAL',
    {VALUE: 'DURATION'},
    'PT1M',
);

console.log(property.toString());
*/

fs.readFile('source.ics', (err, buf) => {
  if (err) {
    console.log('Error: ' + err);
    return;
  }

  console.log(ICalendarComponent.fromBuffer(buf).toString());
});
