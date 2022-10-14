export interface SetAttributeResponse {
  headers: Headers;
}

export interface StatusResponse {
  headers: Headers;
  body: StatusBody;
}

export interface Headers {
  resultCode: string;
  resultMessage: string;
}

export interface StatusBody {
  data: StatusData[];
}

export interface StatusData {
  attributes: StatusAttributes;
}

export interface StatusAttributes {
  // Power
  A02: string;
  // Mode
  A03: string;
  // Airflow
  A04: string;
  // Air Quality
  S07: string;
}
