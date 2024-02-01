import { Airflow, AirQuality, Attribute, AttributeValue, DeviceStatus, Mode, Plasmawave, Power } from './device';
import { SetAttributeResponse, StatusAttributes, StatusBody, StatusResponse } from './response';
import { getErrorMessage, isResponseError } from './error';
import axios, { AxiosResponse } from 'axios';

export class WinixAPI {

  static async getPower(deviceId: string): Promise<Power> {
    return await this.getDeviceAttribute(deviceId, Attribute.Power) as Power;
  }

  static async setPower(deviceId: string, value: Power): Promise<Power> {
    return await this.setDeviceAttribute(deviceId, Attribute.Power, value) as Power;
  }

  static async getMode(deviceId: string): Promise<Mode> {
    return await this.getDeviceAttribute(deviceId, Attribute.Mode) as Mode;
  }

  static async setMode(deviceId: string, value: Mode): Promise<Mode> {
    return await this.setDeviceAttribute(deviceId, Attribute.Mode, value) as Mode;
  }

  static async getAirflow(deviceId: string): Promise<Airflow> {
    return await this.getDeviceAttribute(deviceId, Attribute.Airflow) as Airflow;
  }

  static async setAirflow(deviceId: string, value: Airflow): Promise<Airflow> {
    return await this.setDeviceAttribute(deviceId, Attribute.Airflow, value) as Airflow;
  }

  static async getAirQuality(deviceId: string): Promise<AirQuality> {
    return await this.getDeviceAttribute(deviceId, Attribute.AirQuality) as AirQuality;
  }

  static async getPlasmawave(deviceId: string): Promise<Plasmawave> {
    return await this.getDeviceAttribute(deviceId, Attribute.Plasmawave) as Plasmawave;
  }

  static async setPlasmawave(deviceId: string, value: Plasmawave): Promise<Plasmawave> {
    return await this.setDeviceAttribute(deviceId, Attribute.Plasmawave, value) as Plasmawave;
  }

  static async getAmbientLight(deviceId: string): Promise<number> {
    const rawValue: string = await this.getDeviceAttribute(deviceId, Attribute.AmbientLight);

    if (!rawValue || isEmpty(rawValue)) {
      return -1;
    }

    return parseInt(rawValue, 10);
  }

  static async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    const attributes: StatusAttributes = await this.getDeviceStatusAttributes(deviceId);

    return {
      power: attributes.A02 as Power,
      mode: attributes.A03 as Mode,
      airflow: attributes.A04 as Airflow,
      airQuality: attributes.S07 as AirQuality,
      plasmawave: attributes.A07 as Plasmawave,
      ambientLight: parseInt(attributes.S14, 10),
      filterHours: parseInt(attributes.A21, 10),
    };
  }

  static async getFilterHours(deviceId: string): Promise<number> {
    const rawValue: string = await this.getDeviceAttribute(deviceId, Attribute.FilterHours);

    if (!rawValue || isEmpty(rawValue)) {
      return -1;
    }

    return parseInt(rawValue, 10);
  }

  private static async getDeviceStatusAttributes(deviceId: string): Promise<StatusAttributes> {
    const url: string = WinixAPI.getDeviceStatusUrl(deviceId);
    const result: AxiosResponse<StatusResponse> = await axios.get<StatusResponse>(url);

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
    const result: AxiosResponse<SetAttributeResponse> = await axios.get<SetAttributeResponse>(url);

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
