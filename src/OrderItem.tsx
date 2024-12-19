import React, {
  Button,
  cqAll,
  cqAnd,
  cqEq,
  findEntityPage,
  FixedWidthTable,
  FormLayout,
  getHttpClient,
  InputOption,
  InputText,
  lodash,
  moment,
  observer,
  popupStore,
  registerExtPagePoint,
  toastStore,
  useLocalObservable
} from './__jf'
import { TransportOrderStatus, UiStatusMap } from './constant'

export const OrderItem = observer(props => {
  const { item, onRemove } = props

  const { status } = item.callMaterialOrderData

  const itemRef = React.useRef(null)
  React.useEffect(() => {
    if (status === TransportOrderStatus.Done) {
      itemRef.current.animate([{ borderColor: 'green' }, { borderColor: 'red' }], {
        duration: 1000,
        iterations: Infinity
      })
    }
  }, [status])

  // React.useEffect(() => {
  //   if (item.picked) {
  //     setTimeout(() => {
  //       onRemove()
  //     }, 5000)
  //   }
  // }, [item.picked])

  const takeDOne = async waitAgv => {
    await getHttpClient()
      .post('call/takeDone', {
        id: item.id,
        waitAgv: waitAgv
      })
      .then(() => {
        item.picked = true
      })
  }

  const cancelCall = async () => {
    await getHttpClient().post('call/cancelCall', { id: item.id })
  }

  return (
    <div className="order-item" ref={itemRef}>
      <div className="status-container">
        <div className="status-tag" style={{ backgroundColor: UiStatusMap[status]?.bgColor ?? 'gray' }}>
          {UiStatusMap[status]?.label || '无'}
        </div>
        {/* {item.callMaterialOrderData.status === TransportOrderStatus.Assigned && (
          <div>距离送达还有 {item.remainDistance}</div>
        )} */}
      </div>

      <div className="info-container">
        <div className="left">
          <div>送达位置</div>
          <div className="info-value">{item.callMaterialOrderData.toBin}</div>
        </div>
        <div className="middle">
          <div>物料数量</div>
          <div className="info-value">{item.qty}</div>
        </div>
        <div className="right">
          <div>需拣出数量</div>
          <div className="info-value">{item.planQty}</div>
        </div>
      </div>

      <div className="base-container">
        <div className="left">
          <div>运单:</div>
          <div>{item.callMaterialOrder}</div>
        </div>
        <div className="right">
          <div>机器人:</div>
          <div>{item.callMaterialOrderData.robotName || '无'}</div>
        </div>
      </div>

      <Button
        asBlock
        kind="primary"
        disabled={item.picked || status !== TransportOrderStatus.Done}
        onClick={() => takeDOne(item.callMaterialOrderData.robotName)}
      >
        取料完成
      </Button>

      <br />

      <Button asBlock kind="primary" disabled={item.isCancel} onClick={cancelCall}>
        取消叫料
      </Button>
    </div>
  )
})
