export const StatusList = [
  { value: 'Building', label: '未提交', color: '#16a5a5' },
  { value: 'Created', label: '已提交', color: '#0062b1' },
  { value: 'Assigned', label: '已派车', color: '#7b64ff' },
  { value: 'Failed', label: '失败', color: '#e27300' },
  { value: 'Done', label: '完成', color: '#68bc00' },
  { value: 'Cancelled', label: '取消', color: '#666666' }
]

export const TransportOrderStatus = {
  Building: 'Building',
  Created: 'Created',
  Assigned: 'Assigned',
  Failed: 'Failed',
  Done: 'Done',
  Cancelled: 'Cancelled'
}

export const UiStatusMap = {
  [TransportOrderStatus.Created]: {
    bgColor: '#bfbfff',
    label: '已派单'
  },
  [TransportOrderStatus.Assigned]: {
    bgColor: 'yellow',
    label: '运输中'
  },
  [TransportOrderStatus.Done]: {
    bgColor: '#a4f4a4',
    label: '已送达'
  }
}
