const Property = require('./property');

/**
 * @property {string} name
 * @property {array} properties
 * @property {array} components
 */
class Component {
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
   * @return {Component}
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
        properties.push(Property.fromString(arr[i], i));
      } else if (match[1] == 'BEGIN') {
        const result = Component.fromArrayInternal(arr, i);
        components.push(result[0]);
        i = result[1];
      } else if (match[1] == 'END' && match[2] == name) {
        return [
          new Component(
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
      new Component(
          name,
          properties,
          components,
      ),
      -1,
    ];
  }

  /**
   * @param {Buffer} buf
   * @return {Component}
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

    return Component.fromArray(data);
  }

  /**
   * @param {string} str
   * @return {Component}
   */
  static fromString(str) {
    return Component.fromBuffer(Buffer.from(str));
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

module.exports = Component;
