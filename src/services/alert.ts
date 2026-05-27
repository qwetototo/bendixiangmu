import axios from 'axios';

interface AlertMessageVO {
  title?: string;
  device?: string;
  alertTime?: string;
  alertLevel?: string;
  icon?: string;
}

interface AlertResponseVO {
  status?: number;
  data?: AlertMessageVO[];
}

export interface AlertEvent {
  title: string;
  device: string;
  time: string;
  level: string;
  icon: string;
}

export async function getAllAlertMessage(): Promise<AlertEvent[]> {
  const response = await axios.get<AlertResponseVO>('/api/alerts');
  if (response.data.status !== 200 || !Array.isArray(response.data.data)) {
    return [];
  }

  return response.data.data.map((alert) => ({
    title: alert.title || '未知告警',
    device: alert.device || '--',
    time: formatAlertTime(alert.alertTime),
    level: alert.alertLevel || 'info',
    icon: alert.icon || '!',
  }));
}

function formatAlertTime(value: string | undefined): string {
  if (!value) {
    return '--:--:--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
