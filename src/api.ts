import {
  Airflow, AirQuality, Attribute, AttributeValue, Brightness, ChildLock,
  DeviceCapabilities, DeviceStatus, Mode, Plasmawave, PollutionLamp, Power, Timer, UV,
} from './device';
import { SetAttributeResponse, StatusAttributes, StatusBody, StatusResponse } from './response';
import { getErrorMessage, isResponseError, RateLimitError } from './error';
import axios, { AxiosResponse, isAxiosError } from 'axios';

const AirQualityValues = new Set(
  [
    AirQuality.Good,
    AirQuality.Fair,
    AirQuality.Poor,
  ],
);

export class WinixAPI {

  // Power

  static async getPower(deviceId: string): Promise<Power> {
    return await this.getDeviceAttribute(deviceId, Attribute.Power) as Power;
  }

  static async setPower(deviceId: string, value: Power): Promise<Power> {
    return await this.setDeviceAttribute(deviceId, Attribute.Power, value) as Power;
  }

  // Mode

  static async getMode(deviceId: string): Promise<Mode> {
    return await this.getDeviceAttribute(deviceId, Attribute.Mode) as Mode;
  }

  static async setMode(deviceId: string, value: Mode): Promise<Mode> {
    return await this.setDeviceAttribute(deviceId, Attribute.Mode, value) as Mode;
  }

  // Airflow

  static async getAirflow(deviceId: string): Promise<Airflow> {
    return await this.getDeviceAttribute(deviceId, Attribute.Airflow) as Airflow;
  }

  static async setAirflow(deviceId: string, value: Airflow): Promise<Airflow> {
    return await this.setDeviceAttribute(deviceId, Attribute.Airflow, value) as Airflow;
  }

  // Air Quality

  static async getAirQuality(deviceId: string): Promise<AirQuality> {
    return await this.getDeviceAttribute(deviceId, Attribute.AirQuality) as AirQuality;
  }

  // Plasmawave

  static async getPlasmawave(deviceId: string): Promise<Plasmawave> {
    return await this.getDeviceAttribute(deviceId, Attribute.Plasmawave) as Plasmawave;
  }

  static async setPlasmawave(deviceId: string, value: Plasmawave): Promise<Plasmawave> {
    return await this.setDeviceAttribute(deviceId, Attribute.Plasmawave, value) as Plasmawave;
  }

  // Child Lock

  static async getChildLock(deviceId: string): Promise<ChildLock> {
    return await this.getDeviceAttribute(deviceId, Attribute.ChildLock) as ChildLock;
  }

  static async setChildLock(deviceId: string, value: ChildLock): Promise<ChildLock> {
    return await this.setDeviceAttribute(deviceId, Attribute.ChildLock, value) as ChildLock;
  }

  // Pollution Lamp

  static async getPollutionLamp(deviceId: string): Promise<PollutionLamp> {
    return await this.getDeviceAttribute(deviceId, Attribute.PollutionLamp) as PollutionLamp;
  }

  static async setPollutionLamp(deviceId: string, value: PollutionLamp): Promise<PollutionLamp> {
    return await this.setDeviceAttribute(deviceId, Attribute.PollutionLamp, value) as PollutionLamp;
  }

  // UV

  static async getUV(deviceId: string): Promise<UV> {
    return await this.getDeviceAttribute(deviceId, Attribute.UV) as UV;
  }

  static async setUV(deviceId: string, value: UV): Promise<UV> {
    return await this.setDeviceAttribute(deviceId, Attribute.UV, value) as UV;
  }

  // Brightness

  static async getBrightness(deviceId: string): Promise<Brightness> {
    return await this.getDeviceAttribute(deviceId, Attribute.Brightness) as Brightness;
  }

  static async setBrightness(deviceId: string, value: Brightness): Promise<Brightness> {
    return await this.setDeviceAttribute(deviceId, Attribute.Brightness, value) as Brightness;
  }

  // Timer

  static async getTimer(deviceId: string): Promise<Timer> {
    return await this.getDeviceAttribute(deviceId, Attribute.Timer) as Timer;
  }

  static async setTimer(deviceId: string, value: Timer): Promise<Timer> {
    return await this.setDeviceAttribute(deviceId, Attribute.Timer, value) as Timer;
  }

  // Sensors

  static async getAmbientLight(deviceId: string): Promise<number> {
    return this.getNumericAttribute(deviceId, Attribute.AmbientLight);
  }

  static async getPM25(deviceId: string): Promise<number> {
    return this.getNumericAttribute(deviceId, Attribute.PM25);
  }

  static async getAirQValue(deviceId: string): Promise<number> {
    return this.getNumericAttribute(deviceId, Attribute.AirQValue, parseFloat);
  }

  static async getFilterHours(deviceId: string): Promise<number> {
    return this.getNumericAttribute(deviceId, Attribute.FilterHours);
  }

  // Device Status & Capabilities

  static async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    const attributes: StatusAttributes = await this.getDeviceStatusAttributes(deviceId);

    const status: DeviceStatus = {
      power: attributes[Attribute.Power] as Power,
      mode: attributes[Attribute.Mode] as Mode,
      airflow: attributes[Attribute.Airflow] as Airflow,
      filterHours: parseInt(attributes[Attribute.FilterHours], 10),
    };

    // Populate optional fields if present
    if (attributes[Attribute.AirQuality] !== undefined) {
      status.airQuality = this.parseAirQuality(attributes[Attribute.AirQuality]);
    }
    if (attributes[Attribute.Plasmawave] !== undefined) {
      status.plasmawave = attributes[Attribute.Plasmawave] as Plasmawave;
    }
    if (attributes[Attribute.AmbientLight] !== undefined) {
      status.ambientLight = parseInt(attributes[Attribute.AmbientLight], 10);
    }
    if (attributes[Attribute.ChildLock] !== undefined) {
      status.childLock = attributes[Attribute.ChildLock] as ChildLock;
    }
    if (attributes[Attribute.PollutionLamp] !== undefined) {
      status.pollutionLamp = attributes[Attribute.PollutionLamp] as PollutionLamp;
    }
    if (attributes[Attribute.UV] !== undefined) {
      status.uv = attributes[Attribute.UV] as UV;
    }
    if (attributes[Attribute.Brightness] !== undefined) {
      status.brightness = attributes[Attribute.Brightness] as Brightness;
    }
    if (attributes[Attribute.Timer] !== undefined) {
      status.timer = attributes[Attribute.Timer] as Timer;
    }
    if (attributes[Attribute.FilterDoor] !== undefined) {
      status.filterDoor = attributes[Attribute.FilterDoor];
    }
    if (attributes[Attribute.FilterDetect] !== undefined) {
      status.filterDetect = attributes[Attribute.FilterDetect];
    }
    if (attributes[Attribute.PM25] !== undefined) {
      status.pm25 = parseInt(attributes[Attribute.PM25], 10);
    }
    if (attributes[Attribute.AirQValue] !== undefined) {
      status.airQValue = parseFloat(attributes[Attribute.AirQValue]);
    }

    return status;
  }

  static async getDeviceCapabilities(deviceId: string, modelName?: string): Promise<DeviceCapabilities> {
    const attributes: StatusAttributes = await this.getDeviceStatusAttributes(deviceId);
    return new DeviceCapabilities(modelName ?? 'Unknown', Object.keys(attributes));
  }

  static async getRawAttributes(deviceId: string): Promise<StatusAttributes> {
    return await this.getDeviceStatusAttributes(deviceId);
  }

  // Private helpers

  private static async getNumericAttribute(
    deviceId: string,
    attribute: Attribute,
    parser: (value: string) => number = (v) => parseInt(v, 10),
  ): Promise<number> {
    const rawValue: string = await this.getDeviceAttribute(deviceId, attribute);

    if (!rawValue || isEmpty(rawValue)) {
      return -1;
    }

    return parser(rawValue);
  }

  private static parseAirQuality(value: string): AirQuality {
    if (AirQualityValues.has(value as AirQuality)) {
      return value as AirQuality;
    }

    // Map numeric air quality value to the expected enum
    const quality = parseFloat(value);

    if (quality >= 2.1) {
      return AirQuality.Poor;
    } else if (quality >= 1.1) {
      return AirQuality.Fair;
    }

    return AirQuality.Good;
  }

  private static async getDeviceStatusAttributes(deviceId: string): Promise<StatusAttributes> {
    const url: string = WinixAPI.getDeviceStatusUrl(deviceId);

    let result: AxiosResponse<StatusResponse>;
    try {
      result = await axios.get<StatusResponse>(url);
    } catch (e: unknown) {
      if (isAxiosError(e) && (e.response?.status === 403 || e.response?.status === 429)) {
        throw new RateLimitError();
      }
      throw e;
    }

    const resultMessage: string = result.data.headers.resultMessage;
    const body: StatusBody = result.data.body;

    if (isResponseError(resultMessage) || isEmpty(body) || isEmpty(body.data)) {
      throw new Error(getErrorMessage(resultMessage));
    }

    return body.data[0].attributes;
  }

  private static async getDeviceAttribute(deviceId: string, attribute: Attribute): Promise<AttributeValue> {
    const attributes: StatusAttributes = await this.getDeviceStatusAttributes(deviceId);
    return attributes[attribute];
  }

  private static async setDeviceAttribute(deviceId: string, attribute: Attribute, value: AttributeValue): Promise<AttributeValue> {
    const url: string = WinixAPI.getSetAttributeUrl(deviceId, attribute, value);

    let result: AxiosResponse<SetAttributeResponse>;
    try {
      result = await axios.get<SetAttributeResponse>(url);
    } catch (e: unknown) {
      if (isAxiosError(e) && (e.response?.status === 403 || e.response?.status === 429)) {
        throw new RateLimitError();
      }
      throw e;
    }

    const resultMessage: string = result.data.headers.resultMessage;

    if (isResponseError(resultMessage)) {
      throw new Error(getErrorMessage(resultMessage));
    }

    return value;
  }

  private static getDeviceStatusUrl(deviceId: string): string {
    return `https://us.api.winix-iot.com/common/event/sttus/devices/${deviceId}`;
  }

  private static getSetAttributeUrl(deviceId: string, attribute: Attribute, value: AttributeValue): string {
    return `https://us.api.winix-iot.com/common/control/devices/${deviceId}/A211/${attribute}:${value}`;
  }
}

const isEmpty = (data: object | string): boolean => Object.keys(data).length === 0;
