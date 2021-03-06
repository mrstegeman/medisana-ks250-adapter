/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter, Device, Property } from 'gateway-addon';

import noble, { Peripheral } from '@abandonware/noble';

class MedisanaKS250 extends Device {
  private weightProperty: Property;

  constructor(adapter: Adapter, id: string) {
    super(adapter, `${MedisanaKS250.name}-${id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['MultiLevelSensor'];
    this.name = this.id;
    this.description = 'Medisana KS 250';

    this.weightProperty = new Property(this, 'weight', {
      type: 'number',
      '@type': 'LevelProperty',
      minimum: -5000,
      maximum: 5000,
      unit: 'gram',
      title: 'weight',
      description: 'The measured weight',
      readOnly: true
    });

    this.properties.set('weight', this.weightProperty);
  }

  setData(manufacturerData: Buffer) {
    const value = this.decodeData(manufacturerData);
    this.weightProperty.setCachedValue(value);
    this.notifyPropertyChanged(this.weightProperty);
  }

  decodeData(manufacturerData: Buffer) {
    const {
      length
    } = manufacturerData;

    const b0 = manufacturerData[length - 1];
    const b1 = manufacturerData[length - 2];
    const b2 = manufacturerData[length - 3];
    const b3 = manufacturerData[length - 4];
    const b4 = manufacturerData[length - 5];
    const sign = (b4 & 0x8) ? -1 : 1;

    return sign * (((b3 & 0xf0) << 8) | ((b2 & 0xf0) << 4) | (b1 & 0xf0) | (b0 >> 4));
  }
}

export class MedisanaKS250Adapter extends Adapter {
  private knownDevices: { [key: string]: MedisanaKS250 } = {};

  constructor(addonManager: any, manifest: any) {
    super(addonManager, MedisanaKS250Adapter.name, manifest.name);
    addonManager.addAdapter(this);

    noble.on('stateChange', (state) => {
      console.log('Noble adapter is %s', state);

      if (state === 'poweredOn') {
        console.log('Start scanning for devices');
        noble.startScanning([], true);
      }
    });

    noble.on('discover', (peripheral) => {
      if (peripheral.advertisement.localName == 'KS250') {
        this.addPeripheral(peripheral);
      }
    });
  }

  async addPeripheral(peripheral: Peripheral) {
    const {
      id
    } = peripheral;

    let knownDevice = this.knownDevices[id];

    if (!knownDevice) {
      console.log(`Detected new Medisana KS 250 ${id}`);
      knownDevice = new MedisanaKS250(this, id);
      this.handleDeviceAdded(knownDevice);
      this.knownDevices[id] = knownDevice;
    }

    if (peripheral.advertisement && peripheral.advertisement.manufacturerData) {
      knownDevice.setData(peripheral.advertisement.manufacturerData);
    }
  }
}
