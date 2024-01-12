export interface WinixDevice {
  deviceId: string;
  modelId: string;
  modelIdAwsIot: string;
  modelName: string;
  productGroup: string;
  modelGroupId: string;
  mac: string;
  deviceAlias: string;
  deviceLocCode: string;
  wifiVer: string;
  mcuVer: string;
  updateWifiVer: string;
  updateMcuVer: string;
  popupType: string;
  timezone: number;
  filterReplaceDate: string;
  masterYn: string;
  drsYn: string;
  filterMaxPeriod: string;
  fullWaterBucketAlarm: string;
  filterAlarmMonth: string | null;
  filterUsage: number;
  regWorkTime: string | null;
  regCountry: string | null;
}
