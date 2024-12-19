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
  toastStore,
  useLocalObservable
} from './__jf'
import { TransportOrderStatus } from './constant'
import { OrderItem } from './OrderItem'

const { sortBy, groupBy } = lodash

// 根据工位编码查询叫料单卡片
async function queryCallOrderList(code) {
  const orderLineList = await getHttpClient()
    .post('call/transportCard', { code })
    .then(res => res.data)

  const priorityOrder = [TransportOrderStatus.Done, TransportOrderStatus.Assigned, TransportOrderStatus.Created]
  const sortedArr = sortBy(orderLineList, item => {
    if (!item.callMaterialOrderData) {
      return Infinity
    }
    const index = priorityOrder.indexOf(item.callMaterialOrderData.status)
    return index === -1 ? Infinity : index
  })

  return sortedArr
}

const Work_Site_Code_key = 'smart-call-work-site-code'
const getCachedWorkSiteCode = () => {
  return localStorage.getItem(Work_Site_Code_key)
}
const setCachedWorkSiteCode = code => {
  if (!code) {
    localStorage.removeItem(Work_Site_Code_key)
    return
  }
  localStorage.setItem(Work_Site_Code_key, code)
}

export const SmartCallMaterial = observer(props => {
  React.useEffect(() => {
    init()
    props.pageControl.title = `智能叫料`
  }, [])

  const workSite = useLocalObservable(() => ({
    code: getCachedWorkSiteCode() || '',
    info: {}
  }))

  const formValues = useLocalObservable(() => ({
    code: '',
    callCount: null,
    currentCount: 0,
    qty: null,
    inventoryBoxCount: null
  }))

  const mainData = useLocalObservable(() => ({
    dataSource: [],
    orderList: [],
    callOrderList: [],
    mapDataSource: {}
  }))

  const callFormData = useLocalObservable(() => ({
    callStation: '',
    callMaterial: '',
    callQty: '',
    pickedCount: 0,
    bitLines: []
  }))

  const [workSiteOption, setOption] = React.useState([])
  const [materialOption, setMaterialOption] = React.useState([])
  const [storeInfoList, setStoreInfo] = React.useState([])

  const callCountInputRef = React.useRef(null)

  const fields = [
    {
      label: '物料编码',
      input: (
        <InputOption
          scan
          value={formValues.code}
          options={materialOption}
          onChange={v => {
            formValues.code = v

            console.log('物料编码', v)

            if (v) {
              queryStoreDetail(v)
            }
          }}
          placeholder="示例物料编码: 11001"
        />
      )
    },
    {
      label: '呼叫数量',
      input: (
        <InputText
          ref={callCountInputRef}
          type="int"
          value={formValues.callCount}
          onChange={v => (formValues.callCount = v)}
          placeholder="请输入呼叫数量"
        />
      )
    },
    {
      label: '库存数量',
      input: <InputText type="int" readonly value={formValues.qty} />
    },
    {
      label: '库存箱数',
      input: <InputText type="int" readonly value={formValues.inventoryBoxCount} />
    }
  ]

  async function init() {
    getWorkSite()
    getMaterialList()
  }

  // 获取工位信息
  const getWorkSite = async () => {
    const data = await findEntityPage('FbWorkSite', 1, 999, cqAll, ['-id'])
    setOption(data.page)
  }
  // 获取下拉物料信息

  async function getMaterialList() {
    const data = await findEntityPage('FbMaterial', 1, 999, cqAll, ['-id'])
    setMaterialOption(data.page.map(item => ({ value: item.id, label: item.name })))
  }
  //获取库存明细信息
  async function queryStoreDetail(value) {
    const data = await findEntityPage(
      'FbInvLayout',
      1,
      999,
      cqAnd([cqEq('btMaterialId', value), cqEq('locked', false)]),
      ['inboundOn', '-qty']
    )
    formValues.qty = data.page.map(item => item.qty).reduce((acc, cur) => acc + cur, 0)
    formValues.inventoryBoxCount = data.page.length
    mainData.dataSource = data.page
    // 筛选同一容器的库存明细数量
    let containerKindList = []
    data.page.forEach(item => {
      if (!containerKindList.includes(item.leafContainer)) {
        containerKindList.push(item.leafContainer)
      }
    })
    containerKindList = containerKindList.map(item => {
      const filterList = data.page.filter(container => container.leafContainer === item)
      mainData.mapDataSource[item] = {}
      mainData.mapDataSource[item]['list'] = filterList
      mainData.mapDataSource[item]['qty'] = lodash.reduce(filterList, (acc, cur) => acc + cur.qty, 0)

      return {
        bin: filterList[0]?.bin || '无',
        leafContainer: filterList[0]?.leafContainer || '无',
        qty: lodash.reduce(filterList, (acc, cur) => acc + cur.qty, 0),
        inboundOn: moment(lodash.sortBy(filterList, 'inboundOn')[0]?.inboundOn).format('YYYY-MM-DD HH:mm:ss')
      }
    })

    setStoreInfo(containerKindList)
  }

  const execCallMaterial = async count => {
    console.log('count', count)
    // 调用脚本 生成容器搬运单 叫料单 同时修改库存明细信息
    setCallInfo(count)
    await getHttpClient().post('call/material', {
      // containers: mainData.callOrderList,
      ...callFormData
    })
    toastStore.toastSuccess('叫料成功')
    formValues.currentCount = formValues.callCount
    formValues.callCount = null
    callCountInputRef.current?.inputDom.focus()
  }

  // 叫料时汇总叫料信息
  function setCallInfo(count) {
    let tempCount = 0
    let nowQty = 0
    for (let container in mainData.mapDataSource) {
      const data = mainData.mapDataSource[container]
      const list = data['list']
      const qty = data['qty']
      const bitLines = {
        container: list[0]?.leafContainer || '无',
        bin: list[0].bin,
        qty: qty,
        planQty: qty,
        callMaterialOrder: list[0].id,
        picked: false
      }

      if (nowQty + qty >= count) {
        bitLines.planQty = count - nowQty
        // 然后整理单个容器对应的库存明细记录
        bitLines.fbInvLayout = []
        // 整理出单个容器包含的 库存明细
        for (let i = 0; i < list.length; i++) {
          list[i].usedQty = list[i]?.qty
          if (tempCount >= bitLines.planQty) break
          if (tempCount + list[i].qty > bitLines.planQty) {
            const planQty = count - tempCount
            list[i].usedQty = planQty
          }
          if (tempCount <= bitLines.planQty) {
            tempCount += list[i]?.qty
          }
          bitLines.fbInvLayout.push(list[i])
        }

        callFormData.bitLines.push(bitLines)
        break
      }

      nowQty += qty
      // 整理出单个容器单行
      callFormData.bitLines.push(bitLines)
    }

    callFormData.callStation = workSite.code
    callFormData.callMaterial = formValues.code
    callFormData.callQty = formValues.callCount
  }

  const callMaterial = async () => {
    if (!formValues.callCount) {
      toastStore.toastWarning('请输入呼叫数量')
      return
    }
    await queryStoreDetail(formValues.code)

    if (formValues.callCount > formValues.qty) {
      popupStore.confirm('库存数量不足', '当前呼叫数量大于可用库存数量，是否有多少出多少?').then(r => {
        if (r) {
          execCallMaterial(formValues.qty)
        } else {
          callCountInputRef.current?.inputDom.focus()
        }
      })

      return
    }

    execCallMaterial(formValues.callCount)
  }

  const timerRef = React.useRef(null)
  React.useEffect(() => {
    if (workSite.code) {
      updateOrderList()
      // timerRef.current = setInterval(() => {
      //   updateOrderList()
      // }, 2000)
    }

    return () => {
      clearInterval(timerRef.current)
    }
  }, [workSite.code])

  const updateOrderList = () => {
    queryCallOrderList(workSite.code).then(data => {
      console.log('排序后 运输信息', data)

      mainData.orderList = data
      return

      // 并集 新数据覆盖旧数据
      data.forEach((item, index) => {
        const oldIdx = mainData.orderList.findIndex(oldItem => oldItem.id === item.id)
        if (oldIdx !== -1) {
          mainData.orderList.splice(oldIdx, 1, item)
        } else {
          mainData.orderList.push(item)
        }
      })

      const ids = data.map(item => item.id)
      mainData.orderList.forEach(item => {
        if (!ids.includes(item.id)) {
          item.callMaterialOrderData.status = TransportOrderStatus.Done
        }
      })
    })
  }

  return (
    <div className="smart-call-material">
      <div className="header">
        <div className="header-left">仙工智能叫料终端</div>

        <div className="header-right">
          <span>工位编码</span>
          <InputOption
            scan
            value={workSite.code}
            options={workSiteOption.map(item => ({
              value: item.id,
              label: item.name
            }))}
            onChange={v => {
              workSite.code = v
              setCachedWorkSiteCode(v)
              workSite.info = workSiteOption.find(item => item.id === v)
            }}
            placeholder="请输入工位编码"
          />
        </div>
      </div>

      {workSite.code && (
        <div>
          <h2>工位信息</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <div>工位编码: {workSite.info.id};</div>
            <div>工位名称: {workSite.info.name};</div>
            <div>工位类型: {workSite.info.kind}</div>
          </div>
        </div>
      )}

      {workSite.code ? (
        <div className="main-container">
          <div className="left">
            <div className="left-title">发起新叫料</div>

            <FormLayout fields={fields} />
            <Button asBlock style={{ height: '40px', lineHeight: '40px', padding: 0 }} onClick={callMaterial}>
              叫料
            </Button>

            {formValues.code && (
              <>
                <div style={{ margin: '20px 0' }}>库存信息</div>
                <FixedWidthTable
                  formTable
                  cellPaddingLevel="small"
                  columns={[
                    { label: '所在库位', width: 150 },
                    { label: '料箱编号', width: 150 },
                    { label: '库存数量', width: 150 },
                    { label: '入库时间', width: 200 }
                  ]}
                  cells={storeInfoList.map(item => {
                    return [
                      { content: <div className="cell">{item?.bin || '无'}</div> },
                      { content: <div className="cell">{item?.leafContainer || '无'}</div> },
                      { content: <div className="cell">{item?.qty || 0}</div> },
                      { content: <div className="cell">{item?.inboundOn || '--'}</div> }
                    ]
                  })}
                  getRowKey={(_, idx) => idx.toString()}
                />
              </>
            )}
          </div>

          <div className="divider"></div>
          <div className="right">
            <div className="right-title">
              <span>运输信息</span>
              <span style={{ marginLeft: 10 }}>
                {mainData.orderList.length
                  ? `${
                      mainData.orderList.filter(item => item.callMaterialOrderData.status === TransportOrderStatus.Done)
                        .length
                    }/${mainData.orderList.length}`
                  : null}
              </span>
            </div>

            <button onClick={() => updateOrderList()}>测试按钮 刷新运输卡片列表</button>

            <div className="order-container">
              {mainData.orderList.map((item, index) => (
                <OrderItem item={item} key={item.id} onRemove={() => mainData.orderList.splice(index, 1)} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 300, textAlign: 'center', fontSize: 22 }}>请输入右上角工位编码</div>
      )}
    </div>
  )
})
