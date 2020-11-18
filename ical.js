const fs = require('fs');

/**
 */
class ICalendarProperty {
  /**
   * @param {String} name
   * @param {Object} parameters
   * @param {String} value
   */
  constructor(name, parameters, value) {
    this.name = name;
    this.parameters = parameters;
    this.value = value;
  }

  /**
   * @param {String} str
   * @param {Integer} line
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
    let mode = 'name';
    let scratch = '';

    for (let i = 0; i < str.length; i++) {
      if (escaped) {
        const char = str.charAt(i);
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
            scratch += char;
            break;
          default:
            throw new Error(`Unrecognized escape sequence (${line}:${i})`);
        }
        escaped = false;
      } else if (mode = 'value') {
        value += str.charAt(i);
      } else {
        const char = str.charAt(i);
        switch (char) {
          case '\\':
            escaped = true;
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

    return new ICalendarProperty(
        name.toUpperCase(),
        parameters,
        value,
    );
  }
}

/**
 */
class ICalendarComponent {
  /**
   * @param {String} name
   * @param {Object} properties
   * @param {Object} components
   */
  constructor(name, properties, components) {
    this.name = name;
    this.properties = properties;
    this.components = components;
  }

  /**
   * @param {Array} arr
   * @return {ICalendarComponent}
   */
  static fromArray(arr) {
    const result = this.fromArrayInternal(arr, 0);
    return result[0];
  }

  /**
   * @param {Array} arr
   * @param {Integer} offset
   * @return {Array}
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
    const removeSlashes = (string) => {
      return string.replace(/\\[\\;,Nn]/g, (match) => {
        switch (match) {
          case '\\n':
          case '\\N':
            return '\n';
          case '\\,':
            return ',';
          case '\\;':
            return ';';
          default:
            return match;
        }
      });
    };

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
          data.push(removeSlashes(field.toString('utf-8')));
        }
        field = buf.slice(start, offset);
      }

      start = offset + 2;
    }

    if (start < buf.length) {
      data.push(removeSlashes(field.toString('utf-8')));
    }

    return ICalendarComponent.fromArray(data);
  }

  /**
   * @param {String} str
   * @return {ICalendar}
   */
  static fromString(str) {
    return ICalendarComponent.fromBuffer(Buffer.from(str));
  }
}

fs.readFile('source.ics', (err, buf) => {
  if (err) {
    console.log('Error: ' + err);
    return;
  }

  console.log(ICalendarComponent.fromBuffer(buf));
});
