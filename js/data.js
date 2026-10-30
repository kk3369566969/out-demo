window.AppData = {
  nav: {
    student: [
      { id: "home", label: "首页", icon: "layout-dashboard" },
      { id: "records", label: "我的报修", icon: "clipboard-list", badge: "2" },
      { id: "notices", label: "消息通知", icon: "bell", badge: "3" },
      { id: "guide", label: "服务指南", icon: "circle-help" }
    ],
    technician: [
      { id: "home", label: "工作台", icon: "layout-dashboard" },
      { id: "tasks", label: "任务队列", icon: "list-checks", badge: "4" },
      { id: "route", label: "今日路线", icon: "route" },
      { id: "analytics", label: "工作统计", icon: "chart-no-axes-combined" }
    ]
  },
  student: {
    name: "任同学",
    subtitle: "计算机学院 · 2405",
    currentTicket: {
      id: "WX-20261029-0421",
      title: "卫生间水龙头持续漏水",
      type: "水电维修",
      location: "东区八栋 · 302",
      submitted: "今天 09:20",
      status: "维修中",
      eta: "10:30 前",
      wait: "48 分钟",
      tech: "王师傅",
      techPhone: "138 7112 0348",
      timeline: [
        { label: "已提交", time: "09:20", note: "报修资料已提交", done: true },
        { label: "已受理", time: "09:25", note: "后勤中心已确认信息", done: true },
        { label: "已派单", time: "09:32", note: "已派给水电维修组", done: true },
        { label: "已接单", time: "09:36", note: "王师傅已接单", done: true },
        { label: "待上门", time: "10:18", note: "维修人员已到达", done: true },
        { label: "维修中", time: "10:20", note: "正在更换水龙头阀芯", current: true },
        { label: "已完成", time: "--", note: "等待维修结果确认", done: false }
      ]
    },
    tickets: [
      { id: "WX-20261029-0421", title: "卫生间水龙头持续漏水", location: "东区八栋 · 302", time: "今天 09:20", state: "维修中", stateType: "active", icon: "droplets" },
      { id: "WX-20261028-0178", title: "书桌抽屉滑轨松动", location: "南湖13栋 · 408", time: "昨天 16:45", state: "待评价", stateType: "wait", icon: "armchair" },
      { id: "WX-20261022-0320", title: "宿舍门锁卡顿", location: "东区六栋 · 217", time: "10月22日", state: "已完成", stateType: "done", icon: "door-open" },
      { id: "WX-20261018-0296", title: "宿舍空调制冷不足", location: "南湖九栋 · 216", time: "10月18日", state: "已完成", stateType: "done", icon: "lamp-ceiling" },
      { id: "WX-20261012-0189", title: "阳台地漏排水慢", location: "东区六栋 · 217", time: "10月12日", state: "已完成", stateType: "done", icon: "droplets" },
      { id: "WX-20261008-0114", title: "宿舍窗扣松动", location: "桂子山北区 · 3栋 · 512", time: "10月8日", state: "已完成", stateType: "done", icon: "lamp-ceiling" }
    ],
    notices: [
      { title: "王师傅已到达报修地点", body: "请留意电话，维修将在现场开始。", time: "刚刚", read: false },
      { title: "预计上门时间已更新", body: "当前预计 10:30 前完成上门。", time: "8 分钟前", read: false },
      { title: "报修已受理", body: "后勤中心已确认你的报修资料。", time: "35 分钟前", read: false },
      { title: "报修提交成功", body: "工单 WX-20261029-0421 已创建。", time: "41 分钟前", read: true },
      { title: "维修材料已准备", body: "师傅已准备阀芯，到达后直接处理。", time: "昨天 18:20", read: true },
      { title: "服务时间提醒", body: "宿舍报修服务时间为每天 08:00—22:00。", time: "10月26日", read: true }
    ]
  },
  technician: {
    name: "王师傅",
    subtitle: "水电维修组 · 今日在线",
    metrics: [
      { label: "今日任务", value: "8", hint: "较昨日 +2", icon: "clipboard-check" },
      { label: "待接单", value: "2", hint: "最早等待 18 分钟", icon: "inbox" },
      { label: "维修中", value: "1", hint: "东区八栋 · 302", icon: "hammer" },
      { label: "今日完成", value: "5", hint: "平均用时 28 分钟", icon: "circle-check", tone: "good" }
    ],
    tasks: [
      { id: "WX-20261029-0421", title: "卫生间水龙头持续漏水", location: "东区八栋 · 302", type: "水电维修", submitted: "09:20", priority: "紧急", priorityType: "urgent", status: "待接单", statusType: "wait", tags: ["水电", "有图片"], contact: "任同学 · 138 7112 0348", description: "水龙头阀芯疑似老化，持续滴漏，已上传现场图片。", eta: "10:30 前", material: "阀芯 × 1" },
      { id: "WX-20261029-0417", title: "宿舍门把手松动", location: "南湖13栋 · 408", type: "门窗维修", submitted: "08:56", priority: "普通", priorityType: "normal", status: "待上门", statusType: "active", tags: ["门窗"], contact: "周同学 · 139 8201 7782", description: "门把手下压后无法自动回弹，进出需要手动带回。", eta: "11:10 前", material: "门把手组件" },
      { id: "WX-20261029-0398", title: "公共走廊灯不亮", location: "桂子山北区 · 4栋一楼", type: "公共设施", submitted: "08:24", priority: "普通", priorityType: "normal", status: "维修中", statusType: "active", tags: ["电路", "公共区域"], contact: "后勤中心 · 027 6786 1000", description: "一楼东侧走廊连续两盏灯不亮，夜间通行受影响。", eta: "已到达", material: "LED灯管 × 2" },
      { id: "WX-20261029-0371", title: "饮水机无法加热", location: "南湖校区 · 教学楼B区", type: "设备维修", submitted: "07:45", priority: "普通", priorityType: "normal", status: "已完成", statusType: "done", tags: ["饮水设备"], contact: "后勤中心 · 027 6786 1000", description: "饮水机出水正常但无法加热，已完成电源模块检查。", eta: "已完成", material: "电源模块 × 1" },
      { id: "WX-20261029-0359", title: "宿舍卫生间排风扇异响", location: "东区七栋 · 109", type: "设备维修", submitted: "07:18", priority: "普通", priorityType: "normal", status: "待接单", statusType: "wait", tags: ["排风设备"], contact: "林同学 · 136 8204 1172", description: "排风扇启动后有明显摩擦声，关闭后仍会断续响几秒。", eta: "12:00 前", material: "排风扇检查" },
      { id: "WX-20261029-0322", title: "楼道扶手固定件松动", location: "南湖十二栋 · 2楼", type: "公共设施", submitted: "06:52", priority: "普通", priorityType: "normal", status: "待上门", statusType: "active", tags: ["公共区域", "安全"], contact: "后勤中心 · 027 6786 1000", description: "二楼转角处扶手有晃动，需要重新固定。", eta: "14:00 前", material: "膨胀螺栓 × 2" }
    ],
    route: [
      { time: "09:20", title: "东区八栋 · 302", note: "正在维修 · 水龙头阀芯", icon: "hammer", next: true },
      { time: "11:10", title: "南湖13栋 · 408", note: "待上门 · 门把手松动", icon: "door-open" },
      { time: "13:30", title: "桂子山北区 · 4栋一楼", note: "公共设施巡检", icon: "lamp-ceiling" },
      { time: "15:00", title: "东区七栋 · 109", note: "待接单 · 排风扇异响", icon: "lamp-ceiling" },
      { time: "16:20", title: "南湖十二栋 · 2楼", note: "待上门 · 扶手固定件", icon: "map-pin" }
    ]
  }
};


