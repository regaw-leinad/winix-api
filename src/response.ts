export interface DeviceApiResponse<T> {
  headers: Headers;
  body: T;
}

export interface Headers {
  resultCode: string;
  resultMessage: string;
}

export type SetAttributeResponse = DeviceApiResponse<void>;
export type StatusResponse = DeviceApiResponse<StatusBody>;

export interface StatusBody {
  data: StatusData[];
}

export interface StatusData {
  attributes: StatusAttributes;
}

export interface StatusAttributes {
  // All attributes are dynamic and model-dependent
  [key: string]: string;
}
