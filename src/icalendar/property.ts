/**
 * @property {string} name
 * @property {object} parameters
 * @property {string} value
 */
export default class Property {
  name: string;
  parameters: any;
  value: string;

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
   * @return {Property}
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
        throw new Error(`Unexpected EOL in name (${line})`);
      case 'parameterKey':
        throw new Error(`Unexpected EOL in param key (${line})`);
      case 'parameterValue':
        throw new Error(`Unexpected EOL in param value (${line})`);
    }

    if (name == '') {
      throw new Error(`Invalid property name (${line})`);
    }

    const result = new Property(
        name.toUpperCase(),
        parameters,
        value,
    );

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
