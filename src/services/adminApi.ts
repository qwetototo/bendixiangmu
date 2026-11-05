import { AxiosError } from 'axios';
import { http } from '@/services/http';

export interface Result<T> {
  status: number;
  message: string;
  data: T;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type DeviceStatus = 'online' | 'offline' | 'SOS';

export interface DeviceVO {
  deviceId: string;
  battery: number;
  status: DeviceStatus;
  boundPersonId?: string | null;
  boundPersonName?: string | null;
  buildingId?: string | null;
  buildingName?: string | null;
  floorId?: string | null;
  floorName?: string | null;
}

export interface DeviceWritePayload {
  deviceId: string;
  boundPersonId?: string | null;
  battery: number;
  status: DeviceStatus;
}

export interface DeviceDeploymentPayload {
  buildingId: string;
  floorId: string;
}

export interface PersonnelVO {
  personId: string;
  personName: string;
  name?: string;
  departmentCode?: string | null;
  departmentName?: string | null;
  bindingStatus: 'bound' | 'unbound';
}

export interface PersonnelWritePayload {
  personId: string;
  name: string;
  departmentCode?: string | null;
}

export interface DepartmentVO {
  departmentId?: number;
  code: string;
  name: string;
  personnelCount: number;
}

export interface DepartmentWritePayload {
  code: string;
  name: string;
}

export interface BeaconVO {
  beaconId: string;
  x: number;
  y: number;
  z: number;
  battery: number;
  status: string;
  deploymentStatus: 'undeployed' | 'deployed';
  buildingId?: string | null;
  buildingName?: string | null;
  floorId?: string | null;
  floorName?: string | null;
}

export interface BeaconWritePayload {
  beaconId: string;
  x: number;
  y: number;
  z: number;
  battery: number;
  status: string;
}

export interface BeaconDeploymentPayload {
  buildingId: string;
  floorId: string;
  x: number;
  y: number;
  z: number;
}

export interface AlertEventVO {
  eventId: string;
  title: string;
  deviceId?: string | null;
  personId?: string | null;
  area?: string | null;
  eventType: 'crossing' | 'gather' | 'low_battery' | 'offline' | 'sos' | 'fall';
  alertLevel: 'alarm' | 'warn' | 'normal';
  status: 'pending' | 'processing' | 'closed' | 'ignored';
  remark?: string | null;
  occurredAt: string;
  processedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardSummaryVO {
  totalPersonnel: number;
  /** 已绑定设备且设备在线的人员 */
  activePersonnel: number;
  totalDeviceCount: number;
  /** 已绑定人员（personnel_id 非空）的设备 */
  boundDeviceCount: number;
  /** 已绑定人员的设备状态统计，三种状态互斥 */
  onlineDevices: number;
  offlineDevices: number;
  sosDevices: number;
  lowBatteryDevices: number;
  todayAlertCount: number;
  todayPendingAlertCount: number;
  todayProcessingAlertCount: number;
  todayClosedAlertCount: number;
  todayIgnoredAlertCount: number;
  todayCrossingCount: number;
  todayGatherCount: number;
  todayLowBatteryCount: number;
  todayOfflineCount: number;
  todaySosCount: number;
}

export interface SystemStatusVO {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  cpuCores: number;
  memoryTotalMb: number;
  memoryUsedMb: number;
}

type QueryValue = string | number | boolean | undefined;
type HttpMethod = 'get' | 'post' | 'put' | 'delete';

async function request<T>(
  method: HttpMethod,
  url: string,
  options: { data?: unknown; params?: Record<string, QueryValue> } = {},
): Promise<T> {
  try {
    const response = await http.request<Result<T>>({ method, url, ...options });
    const result = response.data;
    if (result.status !== 200) {
      throw new Error(result.message || '请求失败');
    }
    return result.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const result = error.response?.data as Partial<Result<unknown>> | undefined;
      throw new Error(result?.message || error.message || '请求失败');
    }
    throw error;
  }
}

export function fetchDevices(params: Record<string, QueryValue> = {}) {
  return request<PageResult<DeviceVO>>('get', '/api/devices', { params });
}

export function createDevice(data: DeviceWritePayload) {
  return request<DeviceVO>('post', '/api/devices', { data });
}

export function updateDevice(deviceId: string, data: DeviceWritePayload) {
  return request<DeviceVO>('put', `/api/devices/${encodeURIComponent(deviceId)}`, { data });
}

export function deployDevice(deviceId: string, data: DeviceDeploymentPayload) {
  return request<DeviceVO>('put', `/api/devices/${encodeURIComponent(deviceId)}/deployment`, { data });
}

export function undeployDevice(deviceId: string) {
  return request<DeviceVO>('delete', `/api/devices/${encodeURIComponent(deviceId)}/deployment`);
}

export function deleteDevice(deviceId: string) {
  return request<void>('delete', `/api/devices/${encodeURIComponent(deviceId)}`);
}

export function fetchPersonnel(params: Record<string, QueryValue> = {}) {
  return request<PageResult<PersonnelVO>>('get', '/api/personnel', { params });
}

export const fetchPersonnelBindings = fetchPersonnel;

export function createPersonnel(data: PersonnelWritePayload) {
  return request<PersonnelVO>('post', '/api/personnel', { data });
}

export function updatePersonnel(personId: string, data: PersonnelWritePayload) {
  return request<PersonnelVO>('put', `/api/personnel/${encodeURIComponent(personId)}`, { data });
}

export function deletePersonnel(personId: string) {
  return request<void>('delete', `/api/personnel/${encodeURIComponent(personId)}`);
}

export function fetchDepartments(params: Record<string, QueryValue> = {}) {
  return request<PageResult<DepartmentVO>>('get', '/api/departments', { params });
}

export function createDepartment(data: DepartmentWritePayload) {
  return request<DepartmentVO>('post', '/api/departments', { data });
}

export function updateDepartment(code: string, data: DepartmentWritePayload) {
  return request<DepartmentVO>('put', `/api/departments/${encodeURIComponent(code)}`, { data });
}

export function deleteDepartment(code: string) {
  return request<void>('delete', `/api/departments/${encodeURIComponent(code)}`);
}

export function fetchBeacons(params: Record<string, QueryValue> = {}) {
  return request<PageResult<BeaconVO>>('get', '/api/beacons', { params });
}

export function createBeacon(data: BeaconWritePayload) {
  return request<BeaconVO>('post', '/api/beacons', { data });
}

export function updateBeacon(beaconId: string, data: BeaconWritePayload) {
  return request<BeaconVO>('put', `/api/beacons/${encodeURIComponent(beaconId)}`, { data });
}

export function deleteBeacon(beaconId: string) {
  return request<void>('delete', `/api/beacons/${encodeURIComponent(beaconId)}`);
}

export function deployBeacon(beaconId: string, data: BeaconDeploymentPayload) {
  return request<BeaconVO>('put', `/api/beacons/${encodeURIComponent(beaconId)}/deployment`, { data });
}

export function undeployBeacon(beaconId: string) {
  return request<BeaconVO>('delete', `/api/beacons/${encodeURIComponent(beaconId)}/deployment`);
}

export function fetchAlertEvents(params: Record<string, QueryValue> = {}) {
  return request<PageResult<AlertEventVO>>('get', '/api/alert-events', { params });
}

export function createAlertEvent(data: AlertEventVO) {
  return request<AlertEventVO>('post', '/api/alert-events', { data });
}

export function updateAlertEvent(eventId: string, data: Partial<Pick<AlertEventVO, 'status' | 'alertLevel' | 'remark'>>) {
  return request<AlertEventVO>('put', `/api/alert-events/${encodeURIComponent(eventId)}`, { data });
}

export function fetchDashboardSummary(params: Record<string, QueryValue> = {}) {
  return request<DashboardSummaryVO>('get', '/api/dashboard/summary', { params });
}

export function fetchSystemStatus() {
  return request<SystemStatusVO>('get', '/api/dashboard/system-status');
}
