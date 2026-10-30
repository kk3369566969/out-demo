(function () {
  const data = window.AppData;
  const sharedKeys = {
    tasks: "ccnu-demo-tasks",
    ticket: "ccnu-demo-student-ticket"
  };

  function readSharedValue(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function mergeTasks(existing, incoming) {
    const merged = new Map();
    [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((task) => {
      if (!task || !task.id) return;
      const previous = merged.get(task.id);
      if (!previous || (Number(task.updatedAt) || 0) >= (Number(previous.updatedAt) || 0)) merged.set(task.id, task);
    });
    return [...merged.values()].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
  }

  function removeDuplicateTasks(tasks) {
    const unique = new Map();
    (Array.isArray(tasks) ? tasks : []).forEach((task) => {
      if (!task || !task.id) return;
      const key = `${task.title || task.id}|${task.location || ""}`;
      const previous = unique.get(key);
      if (!previous || (Number(task.updatedAt) || 0) >= (Number(previous.updatedAt) || 0)) unique.set(key, task);
    });
    return [...unique.values()];
  }

  function getTabMeta() {
    const meta = { role: "student", authenticated: false };
    String(window.name || "").split("|").forEach((part) => {
      const [key, value] = part.split("=");
      if (key === "ccnu-role" && (value === "student" || value === "technician")) meta.role = value;
      if (key === "ccnu-auth") meta.authenticated = value === "1";
    });
    return meta;
  }

  function setTabMeta(changes) {
    const next = { ...getTabMeta(), ...changes };
    try { window.name = `ccnu-role=${next.role}|ccnu-auth=${next.authenticated ? "1" : "0"}`; } catch { /* ignore restricted browsing contexts */ }
    try {
      sessionStorage.setItem("ccnu-demo-role", next.role);
      sessionStorage.setItem("ccnu-demo-auth", next.authenticated ? "true" : "false");
    } catch { /* ignore */ }
  }

  function getTabRole() { return getTabMeta().role; }
  function setTabRole(role) { setTabMeta({ role }); }

  const rawSharedTasks = readSharedValue(sharedKeys.tasks);
  const sharedTasks = Array.isArray(rawSharedTasks)
    ? rawSharedTasks.filter((task) => !String(task?.title || "").includes("测试同步"))
    : rawSharedTasks;
  const rawSharedTicket = readSharedValue(sharedKeys.ticket);
  const sharedTicket = rawSharedTicket && !String(rawSharedTicket.title || "").includes("测试同步")
    ? rawSharedTicket
    : null;
  const state = {
    // 角色属于当前标签页，不能放在 localStorage，否则学生端和师傅端会互相覆盖。
    role: getTabRole(),
    activeNav: "home",
    studentTicket: structuredClone(data.student.currentTicket),
    tasks: structuredClone(data.technician.tasks),
    taskFilter: "全部",
    unread: data.student.notices.filter((notice) => !notice.read).length,
    selectedTaskId: data.technician.tasks[0].id,
    recordsExpanded: false,
    noticesExpanded: false
  };

  if (Array.isArray(sharedTasks)) state.tasks = removeDuplicateTasks(sharedTasks);
  if (sharedTicket && typeof sharedTicket === "object") state.studentTicket = sharedTicket;
  if (Array.isArray(rawSharedTasks) && rawSharedTasks.length !== state.tasks.length) {
    try { localStorage.setItem(sharedKeys.tasks, JSON.stringify(state.tasks)); } catch { /* ignore */ }
  }
  if (rawSharedTicket && !sharedTicket) {
    try { localStorage.setItem(sharedKeys.ticket, JSON.stringify(state.studentTicket)); } catch { /* ignore */ }
  }

  let sharedChannel = null;
  try {
    sharedChannel = new BroadcastChannel("ccnu-demo-repair-sync");
  } catch {
    sharedChannel = null;
  }

  const appShell = document.getElementById("appShell");
  const authRoot = document.getElementById("authRoot");
  const defaultAccounts = {
    student: { account: "student@ccnu.edu.cn", password: "123456", name: "任同学", subtitle: "计算机学院 · 2405" },
    technician: { account: "tech@ccnu.edu.cn", password: "123456", name: "王师傅", subtitle: "水电维修组 · 今日在线" }
  };
  const accounts = JSON.parse(localStorage.getItem("ccnu-demo-accounts") || "null") || defaultAccounts;
  const authState = { mode: "login", role: state.role, error: "" };
  let isAuthenticated = getTabMeta().authenticated;

  const appContent = document.getElementById("appContent");
  const primaryNav = document.getElementById("primaryNav");
  const modalRoot = document.getElementById("modalRoot");
  const toastRegion = document.getElementById("toastRegion");

  const statusLabels = ["已提交", "已受理", "已派单", "已接单", "待上门", "维修中", "已完成"];

  function saveSharedData() {
    const latestTasks = readSharedValue(sharedKeys.tasks);
    state.tasks = removeDuplicateTasks(mergeTasks(latestTasks, state.tasks));
    try {
      localStorage.setItem(sharedKeys.tasks, JSON.stringify(state.tasks));
      localStorage.setItem(sharedKeys.ticket, JSON.stringify(state.studentTicket));
    } catch {
      // The UI remains usable when browser storage is unavailable; BroadcastChannel can still sync open tabs.
    }
    if (sharedChannel) sharedChannel.postMessage({
      type: "shared-data",
      tasks: state.tasks,
      studentTicket: state.studentTicket
    });
  }

  function syncSharedData(shouldRender = true, showNotice = false) {
    const latestTasks = readSharedValue(sharedKeys.tasks);
    const latestTicket = readSharedValue(sharedKeys.ticket);
    const tasksChanged = Array.isArray(latestTasks) && JSON.stringify(latestTasks) !== JSON.stringify(state.tasks);
    const ticketChanged = latestTicket && JSON.stringify(latestTicket) !== JSON.stringify(state.studentTicket);
    if (Array.isArray(latestTasks)) state.tasks = removeDuplicateTasks(latestTasks);
    if (latestTicket && typeof latestTicket === "object") state.studentTicket = latestTicket;
    if (shouldRender && isAuthenticated && (tasksChanged || ticketChanged)) renderApp();
    if (showNotice && tasksChanged && state.role === "technician") toast("收到新报修", "学生端刚刚提交了一条新的维修任务。", "bell");
    if (ticketChanged && state.role === "student") toast("工单状态更新", `当前状态：${state.studentTicket.status}。`, "refresh-cw");
  }

  function syncRouteFromHash() {
    const hashRoute = window.location.hash.replace(/^#/, "");
    if (hashRoute && data.nav[state.role].some((item) => item.id === hashRoute)) state.activeNav = hashRoute;
  }

  function renderAuth() {
    if (isAuthenticated) {
      authRoot.innerHTML = "";
      appShell.classList.remove("is-auth-locked");
      return;
    }
    appShell.classList.add("is-auth-locked");
    const isLogin = authState.mode === "login";
    authRoot.innerHTML = `
      <main class="auth-screen">
        <section class="auth-visual" aria-label="修好了产品介绍">
          <div class="auth-brand"><div class="brand-mark" aria-hidden="true"><span class="brand-mark__orbit"></span><span class="brand-mark__dot"></span></div><div><div class="auth-brand__name">修好了</div><div class="auth-brand__sub">CCNU · 校园设施服务</div></div></div>
          <div class="auth-visual__copy"><p class="auth-visual__eyebrow">华中师范大学 · 后勤服务</p><h1>校园设施有问题？先报修，后跟进。</h1><p>提交地点和故障描述，后勤中心会在处理节点更新进度。</p><div class="auth-visual__features"><span class="auth-feature"><span data-icon="route"></span>受理到完成</span><span class="auth-feature"><span data-icon="map-pin"></span>桂子山 · 南湖校区</span><span class="auth-feature"><span data-icon="circle-check"></span>每日 08:00—22:00</span></div></div>
          <div class="auth-visual__foot">华中师范大学后勤服务 · 08:00—22:00</div>
        </section>
        <section class="auth-card-wrap"><div class="auth-card">
          <div class="auth-card__head"><h2>${isLogin ? "登录校园报修" : "创建服务账号"}</h2><p>${isLogin ? "选择账号类型后进入对应工作台" : "请选择角色，注册对应的服务账号"}</p></div>
          <div class="auth-tabs" role="tablist"><button class="auth-tab ${isLogin ? "is-active" : ""}" type="button" data-auth-mode="login" role="tab" aria-selected="${isLogin}">登录</button><button class="auth-tab ${!isLogin ? "is-active" : ""}" type="button" data-auth-mode="register" role="tab" aria-selected="${!isLogin}">注册</button></div>
          <div class="auth-role" role="group" aria-label="选择账号角色"><button class="auth-role__button ${authState.role === "student" ? "is-active" : ""}" type="button" data-auth-role="student"><span data-icon="user-round"></span>学生端</button><button class="auth-role__button ${authState.role === "technician" ? "is-active" : ""}" type="button" data-auth-role="technician"><span data-icon="wrench"></span>维修师傅端</button></div>
          <form class="auth-form" id="authForm"><div class="auth-field"><label for="authAccount">${authState.role === "student" ? "学号 / 校园邮箱" : "工号 / 维修账号"}</label><input id="authAccount" name="account" autocomplete="username" placeholder="${authState.role === "student" ? "如 2024214334 或 student@ccnu.edu.cn" : "如 WX-018 或 tech@ccnu.edu.cn"}" required /></div>${!isLogin ? `<div class="auth-field"><label for="authName">姓名</label><input id="authName" name="name" autocomplete="name" placeholder="请输入姓名" required /></div><div class="auth-field"><label for="authPhone">联系电话</label><input id="authPhone" name="phone" type="tel" autocomplete="tel" placeholder="用于接收维修通知" required /></div>` : ""}<div class="auth-field"><label for="authPassword">密码</label><input id="authPassword" name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" placeholder="至少 6 位字符" required /></div>${!isLogin ? `<div class="auth-field"><label for="authPasswordConfirm">确认密码</label><input id="authPasswordConfirm" name="passwordConfirm" type="password" autocomplete="new-password" placeholder="再次输入密码" required /></div>` : `<div class="auth-password-row"><label class="auth-check"><input type="checkbox" name="remember" /> 记住本次登录</label><button class="auth-link" type="button" data-action="forgot-password">忘记密码？</button></div>`}<div class="auth-error" role="alert">${authState.error}</div><button class="auth-submit" type="submit">${isLogin ? `登录${authState.role === "student" ? "学生端" : "维修师傅端"}` : "注册并进入工作台"}</button></form><div class="auth-hint">演示账号：${authState.role === "student" ? "student@ccnu.edu.cn / 123456" : "tech@ccnu.edu.cn / 123456"}</div><p class="auth-card__legal">登录即表示你同意校园设施服务平台的使用规则。账号角色决定可访问的工作台。</p>
        </div></section>
      </main>`;
    window.hydrateIcons(authRoot);
  }

  function getActiveNavItem() {
    return data.nav[state.role].find((item) => item.id === state.activeNav) || data.nav[state.role][0];
  }

  function renderShell() {
    document.querySelectorAll(".role-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.role === state.role);
    });

    const navItems = data.nav[state.role];
    primaryNav.innerHTML = navItems.map((item) => `
      <button class="nav-item ${item.id === state.activeNav ? "is-active" : ""}" type="button" data-nav="${item.id}">
        <span data-icon="${item.icon}" aria-hidden="true"></span>
        <span>${item.label}</span>
        ${item.badge ? `<span class="nav-item__badge">${state.role === "student" && item.id === "notices" ? state.unread : state.role === "technician" && item.id === "tasks" ? state.tasks.filter((task) => task.status !== "已完成").length : item.badge}</span>` : ""}
      </button>
    `).join("");

    const isStudent = state.role === "student";
    const activeAccount = accounts[state.role] || defaultAccounts[state.role];
    document.getElementById("breadcrumb").textContent = `${isStudent ? "学生端" : "维修师傅端"} / ${getActiveNavItem().label}`;
    document.getElementById("profileChip").innerHTML = `
      <div class="avatar ${isStudent ? "avatar--student" : "avatar--tech"}">${(activeAccount.name || (isStudent ? "任" : "王")).slice(0, 1)}</div>
      <div class="profile-chip__copy"><strong>${activeAccount.name || (isStudent ? data.student.name : data.technician.name)}</strong><span>${activeAccount.subtitle || (isStudent ? data.student.subtitle : data.technician.subtitle)}</span></div>
      <span data-icon="chevron-down" aria-hidden="true"></span>
    `;
    document.getElementById("notificationBadge").textContent = isStudent ? state.unread : "2";
    document.getElementById("notificationBadge").hidden = (isStudent ? state.unread : 2) === 0;
    window.hydrateIcons();
  }

  function renderApp() {
    renderShell();
    appContent.innerHTML = state.role === "student" ? renderStudentPage() : renderTechnicianPage();
    window.hydrateIcons(appContent);
  }

  function renderStudentPage() {
    if (state.activeNav === "records") return renderStudentRecords();
    if (state.activeNav === "notices") return renderNotificationsPage();
    if (state.activeNav === "guide") return renderGuidePage();
    const ticket = state.studentTicket;
    const currentIndex = Math.max(0, ticket.timeline.findIndex((step) => step.current));
    return `
      <section class="page-head">
        <div><p class="eyebrow">学生服务</p><h1>校园报修</h1><p>提交报修，查看处理进度。</p></div>
        <button class="button button--primary" type="button" data-action="open-repair"><span data-icon="plus"></span>快速报修</button>
      </section>
      <div class="signal-strip"><div class="signal-strip__left"><span data-icon="circle-check"></span><strong>受理时间 08:00—22:00</strong><span>公共区域和宿舍维修均可提交</span></div><button class="signal-strip__link" type="button" data-action="open-guide">查看范围</button></div>
      <section class="student-grid" aria-label="当前报修状态">
        <article class="hero-panel">
          <div class="panel-kicker">当前工单 · ${ticket.id}</div>
          <div class="hero-title-row"><h2>${ticket.title}</h2><span class="status-pill"><i class="status-pill__dot"></i>${ticket.status}</span></div>
          <div class="hero-meta"><span><span data-icon="map-pin"></span>${ticket.location}</span><span><span data-icon="wrench"></span>${ticket.tech} · ${ticket.techPhone}</span><span><span data-icon="calendar-clock"></span>预计 ${ticket.eta} 上门</span></div>
          <div class="journey" aria-label="报修进度">
            ${ticket.timeline.map((step, index) => `<div class="journey-step ${step.done ? "is-done" : ""} ${step.current ? "is-current" : ""}"><i class="journey-step__dot"></i><span>${step.label}</span></div>`).join("")}
          </div>
          <div class="journey-note"><span data-icon="clock-3"></span><span>师傅已到达，正在现场处理。已等待 ${ticket.wait}，最新更新于 10:20。</span></div>
          <div class="hero-actions"><button class="button button--primary" type="button" data-action="open-ticket"><span data-icon="file-clock"></span>查看完整进度</button><button class="button button--secondary" type="button" data-action="nudge" ${ticket.nudged ? "disabled" : ""}><span data-icon="megaphone"></span>${ticket.nudged ? "已发送催单" : "提醒后勤"}</button></div>
        </article>
        <article class="map-panel"><div class="map-panel__head"><h3>上门位置</h3><span>桂子山校区 · 东区</span></div><div class="campus-map" aria-label="东区八栋示意地图"><div class="map-road map-road--a"></div><div class="map-road map-road--b"></div><span class="map-block map-block--1">六栋</span><span class="map-block map-block--2">七栋</span><span class="map-block map-block--3">九栋</span><span class="map-block map-block--4">食堂</span><span class="map-block map-block--5">活动场</span><span class="map-pin"><span data-icon="map-pin"></span></span><span class="map-label">东区八栋 · 302</span></div><div class="map-legend"><span><i class="is-active"></i>维修位置</span><span><i></i>校园建筑</span><span>预计 10:30 前</span></div></article>
      </section>
      <section class="section-block"><div class="section-heading"><h2>常用操作</h2><button type="button" data-action="open-guide">报修说明</button></div><div class="quick-actions"><button class="quick-action" type="button" data-action="open-repair"><span class="quick-action__icon"><span data-icon="plus"></span></span><strong>提交新报修</strong><span>水电、门窗、空调…</span></button><button class="quick-action" type="button" data-action="scan"><span class="quick-action__icon"><span data-icon="scan-line"></span></span><strong>扫码报修</strong><span>自动带入楼栋房间</span></button><button class="quick-action" type="button" data-action="open-notifications"><span class="quick-action__icon"><span data-icon="message-square-text"></span></span><strong>查看通知</strong><span>${state.unread} 条未读消息</span></button><button class="quick-action" type="button" data-action="open-records"><span class="quick-action__icon"><span data-icon="file-clock"></span></span><strong>我的报修</strong><span>查看全部工单记录</span></button></div></section>
      <section class="service-reference"><div class="service-reference__head"><span class="service-reference__number">01</span><div><h2>报修前看一眼</h2><p>把关键信息一次写全，师傅到场后可以直接处理。</p></div></div><div class="service-reference__grid"><div><span>地点</span><strong>楼栋 · 房间</strong><small>例如：东区八栋 · 302</small></div><div><span>描述</span><strong>现象 · 影响</strong><small>漏水、异响、无法通电</small></div><div><span>照片</span><strong>拍清细节</strong><small>设备编号和故障位置</small></div><div><span>时间</span><strong>可上门时段</strong><small>今天 10:00—12:00</small></div></div></section><section class="home-next-step"><div><strong>历史工单和评价</strong><span>在“我的报修”中查看全部记录</span></div><button class="button button--quiet button--small" type="button" data-action="open-records">打开记录</button></section>
    `;
  }

  function renderTicketRow(ticket) {
    return `<button class="ticket-row" type="button" data-action="open-ticket" data-ticket-id="${ticket.id}"><span class="ticket-icon"><span data-icon="${ticket.icon}"></span></span><span class="ticket-copy"><strong>${ticket.title}</strong><span>${ticket.location} · ${ticket.time}</span></span><span class="ticket-state ticket-state--${ticket.stateType}">${ticket.state}</span></button>`;
  }

  function renderStudentRecords() {
    const current = state.studentTicket;
    const currentRecord = { id: current.id, title: current.title, location: current.location, time: current.submitted || "刚刚", state: current.status, stateType: current.status === "已完成" ? "done" : current.status === "已提交" ? "wait" : "active", icon: current.type === "空调设备" ? "lamp-ceiling" : "wrench" };
    const recordItems = [currentRecord, ...data.student.tickets.filter((ticket) => ticket.id !== current.id), { id: "WX-20261015-0091", title: "公共区域饮水机漏水", location: "南湖校区 · 教学楼B区", time: "10月15日 · 14:10", state: "已完成", stateType: "done", icon: "droplets" }];
    const visibleRecords = state.recordsExpanded ? recordItems : recordItems.slice(0, 4);
    const completedCount = recordItems.filter((ticket) => ticket.state === "已完成").length;
    const pendingReviewCount = recordItems.filter((ticket) => ticket.state === "待评价").length;
    return `<section class="page-head"><div><p class="eyebrow">报修记录</p><h1>我的报修</h1><p>按时间查看报修记录和处理结果。</p></div><button class="button button--primary" type="button" data-action="open-repair"><span data-icon="plus"></span>新建报修</button></section><div class="metrics-grid"><div class="metric-card"><div class="metric-card__top"><span>全部工单</span><span class="metric-card__icon"><span data-icon="clipboard-list"></span></span></div><div class="metric-card__value">${recordItems.length}</div><div class="metric-card__hint">本学期累计</div></div><div class="metric-card metric-card--good"><div class="metric-card__top"><span>已完成</span><span class="metric-card__icon"><span data-icon="circle-check"></span></span></div><div class="metric-card__value">${completedCount}</div><div class="metric-card__hint">已归档工单</div></div><div class="metric-card metric-card--urgent"><div class="metric-card__top"><span>待评价</span><span class="metric-card__icon"><span data-icon="star"></span></span></div><div class="metric-card__value">${pendingReviewCount}</div><div class="metric-card__hint">完成后记得反馈</div></div><div class="metric-card"><div class="metric-card__top"><span>平均响应</span><span class="metric-card__icon"><span data-icon="clock-3"></span></span></div><div class="metric-card__value">18<span style="font-size:14px;letter-spacing:0">分钟</span></div><div class="metric-card__hint">从提交到受理</div></div></div><div class="subpage-grid"><article class="list-panel"><div class="section-heading"><h2>全部记录</h2><button type="button" data-action="toggle-records">${state.recordsExpanded ? "收起记录" : "查看全部"}</button></div><div class="subpage-list">${visibleRecords.map((ticket) => `<button class="subpage-card" type="button" data-action="open-ticket"><span class="subpage-card__main"><span class="subpage-icon"><span data-icon="${ticket.icon}"></span></span><span><strong>${ticket.title}</strong><span>${ticket.location} · ${ticket.time}</span></span></span><span class="ticket-state ticket-state--${ticket.stateType}">${ticket.state}</span></button>`).join("")}</div></article><article class="info-panel"><h3>处理进度怎么看？</h3><p>进入任意一条工单，都能看到从提交到完成的完整时间轴。</p><div class="guide-steps"><div class="guide-step"><span class="guide-step__number">1</span><span><strong>查看当前状态</strong><span>状态标签会告诉你工单正在谁手里。</span></span></div><div class="guide-step"><span class="guide-step__number">2</span><span><strong>关注预计时间</strong><span>师傅调整上门时间后，你会收到通知。</span></span></div><div class="guide-step"><span class="guide-step__number">3</span><span><strong>完成后确认</strong><span>问题仍未解决时，选择“反馈问题”。</span></span></div></div></article></div>`;
  }

  function renderNotificationsPage() {
    return `<section class="page-head"><div><p class="eyebrow">消息中心</p><h1>消息通知</h1><p>这里显示工单的受理、派单、上门和完成记录。</p></div><button class="button button--quiet" type="button" data-action="mark-all-read"><span data-icon="check"></span>全部标为已读</button></section><div class="subpage-grid"><article class="list-panel"><div class="section-heading"><h2>最近消息</h2><span style="color:#7a8c9e;font-size:12px">${state.unread} 条未读</span></div><div class="notice-list">${data.student.notices.map((notice, index) => `<button class="notice-item ${notice.read ? "is-read" : ""}" type="button" data-action="read-notice" data-notice-index="${index}"><i class="notice-item__dot"></i><span><strong>${notice.title}</strong><span>${notice.body}</span></span><time>${notice.time}</time></button>`).join("")}</div></article><article class="info-panel"><h3>哪些变化会提醒你</h3><p>提交后，下面这些节点会在工单里留下记录。</p><div class="guide-steps"><div class="guide-step"><span class="guide-step__number"><span data-icon="send"></span></span><span><strong>报修提交</strong><span>确认工单编号和报修地点。</span></span></div><div class="guide-step"><span class="guide-step__number"><span data-icon="wrench"></span></span><span><strong>状态变化</strong><span>受理、派单、接单、上门和维修中。</span></span></div><div class="guide-step"><span class="guide-step__number"><span data-icon="circle-check"></span></span><span><strong>结果确认</strong><span>完成后确认，帮助工单顺利归档。</span></span></div></div></article></div>`;
  }

  function renderGuidePage() {
    return `<section class="page-head"><div><p class="eyebrow">服务指南</p><h1>服务指南</h1><p>在桂子山与南湖校区，遇到校园设施问题可以这样做。</p></div><button class="button button--primary" type="button" data-action="open-repair"><span data-icon="plus"></span>开始报修</button></section><div class="subpage-grid"><article class="info-panel"><h3>四步完成一次报修</h3><p>提交补充地点和照片，师傅更容易找到问题。</p><div class="guide-steps"><div class="guide-step"><span class="guide-step__number">1</span><span><strong>选择准确地点</strong><span>可扫楼栋或设备旁的二维码，自动带入东区八栋、南湖13栋等位置。</span></span></div><div class="guide-step"><span class="guide-step__number">2</span><span><strong>描述问题并上传图片</strong><span>尽量拍清楚漏水点、松动位置或设备编号。</span></span></div><div class="guide-step"><span class="guide-step__number">3</span><span><strong>确认预计上门时间</strong><span>师傅接单后会同步预计时间，发生调整也会通知你。</span></span></div><div class="guide-step"><span class="guide-step__number">4</span><span><strong>维修完成后确认</strong><span>检查问题是否解决，再进行评价或反馈问题。</span></span></div></div></article><article class="list-panel"><h3 style="margin:0;font-size:16px">常见服务范围</h3><div class="subpage-list" style="margin-top:14px"><div class="subpage-card"><span class="subpage-card__main"><span class="subpage-icon"><span data-icon="droplets"></span></span><span><strong>水电维修</strong><span>漏水、断电、灯具和插座</span></span></span><span>01</span></div><div class="subpage-card"><span class="subpage-card__main"><span class="subpage-icon"><span data-icon="door-open"></span></span><span><strong>门窗维修</strong><span>门锁、门把手、窗户五金</span></span></span><span>02</span></div><div class="subpage-card"><span class="subpage-card__main"><span class="subpage-icon"><span data-icon="lamp-ceiling"></span></span><span><strong>设备维修</strong><span>空调、饮水机、公共设施</span></span></span><span>03</span></div><div class="subpage-card"><span class="subpage-card__main"><span class="subpage-icon"><span data-icon="circle-help"></span></span><span><strong>其他问题</strong><span>无法判断类型时也可以提交</span></span></span><span>04</span></div></div><div class="service-contact"><strong>后勤服务中心</strong><span>桂子山、南湖校区 · 08:00—22:00</span><button type="button" data-action="show-support"><span data-icon="phone"></span>查看联系电话</button></div></article></div>`;
  }

  function renderTechnicianPage() {
    if (state.activeNav === "route") return renderRoutePage();
    if (state.activeNav === "analytics") return renderAnalyticsPage();
    if (state.activeNav === "tasks") return renderTasksPage();
    const visibleTasks = state.tasks.filter((task) => state.taskFilter === "全部" || task.status === state.taskFilter || (state.taskFilter === "紧急" && task.priority === "紧急"));
    const urgentCount = state.tasks.filter((task) => task.priority === "紧急").length;
    const waitingCount = state.tasks.filter((task) => task.status === "待接单").length;
    const repairingCount = state.tasks.filter((task) => task.status === "维修中").length;
    const completedCount = state.tasks.filter((task) => task.status === "已完成").length;
    const liveMetrics = [
      { label: "今日任务", value: state.tasks.length, hint: "按提交时间排序", icon: "clipboard-check" },
      { label: "待接单", value: waitingCount, hint: waitingCount ? "需要尽快确认" : "当前没有待接单", icon: "inbox", tone: waitingCount ? "urgent" : "" },
      { label: "维修中", value: repairingCount, hint: repairingCount ? "更新现场进度" : "当前没有进行中任务", icon: "hammer" },
      { label: "今日完成", value: completedCount, hint: "完成后请填写处理结果", icon: "circle-check", tone: "good" }
    ];
    return `<section class="page-head"><div><p class="eyebrow">维修工作台</p><h1>今天的维修任务</h1><p>按状态查看任务，接单后更新处理进度。</p></div><span class="status-pill" style="color:#21655e;background:#ddf3ee;border-color:#b9e6dd"><i class="status-pill__dot" style="background:#0b8f83"></i>在线接单中</span></section><div class="metrics-grid">${liveMetrics.map((metric) => `<article class="metric-card ${metric.tone === "good" ? "metric-card--good" : ""} ${metric.tone === "urgent" ? "metric-card--urgent" : ""}"><div class="metric-card__top"><span>${metric.label}</span><span class="metric-card__icon"><span data-icon="${metric.icon}"></span></span></div><div class="metric-card__value">${metric.value}</div><div class="metric-card__hint">${metric.hint}</div></article>`).join("")}</div><div class="tech-layout tech-layout--home"><article class="task-panel"><div class="section-heading"><div><h2>今日任务队列</h2><span style="display:block;margin-top:3px;color:#7a8c9e;font-size:11px">先看紧急和临近上门的任务</span></div><button type="button" data-action="refresh-tasks"><span data-icon="refresh-cw"></span>刷新</button></div><div class="task-filter"><button class="filter-button ${state.taskFilter === "全部" ? "is-active" : ""}" data-action="filter-task" data-filter="全部" type="button">全部 ${state.tasks.length}</button><button class="filter-button ${state.taskFilter === "紧急" ? "is-active" : ""}" data-action="filter-task" data-filter="紧急" type="button">紧急 ${urgentCount}</button><button class="filter-button ${state.taskFilter === "待接单" ? "is-active" : ""}" data-action="filter-task" data-filter="待接单" type="button">待接单 ${waitingCount}</button><button class="filter-button ${state.taskFilter === "维修中" ? "is-active" : ""}" data-action="filter-task" data-filter="维修中" type="button">维修中 ${repairingCount}</button></div><div class="task-list">${visibleTasks.length ? visibleTasks.map(renderTaskCard).join("") : `<div class="empty-state"><span data-icon="circle-check"></span><strong>这个筛选下暂时没有任务</strong><span>可以切换到“全部”查看完整队列。</span></div>`}</div></article><aside class="route-panel"><div class="route-panel__head"><h2>今日路线</h2><span>${data.technician.route.length} 个地点</span></div><div class="route-list">${data.technician.route.map((item) => `<div class="route-item ${item.next ? "is-next" : ""}"><span class="route-dot"><span data-icon="${item.icon}"></span></span><span><strong>${item.time} · ${item.title}</strong><span>${item.note}</span></span></div>`).join("")}</div><div class="route-tip"><span data-icon="info"></span><span>打开任务卡片可查看学生描述、联系方式和建议材料。</span></div></aside></div>`;
  }

  function renderTasksPage() {
    const visibleTasks = state.tasks.filter((task) => state.taskFilter === "全部" || task.status === state.taskFilter || (state.taskFilter === "紧急" && task.priority === "紧急"));
    return `<section class="page-head"><div><p class="eyebrow">任务列表</p><h1>任务队列</h1><p>按紧急程度和处理状态查看所有待办任务，打开任务即可更新维修进度。</p></div><button class="button button--quiet" type="button" data-action="refresh-tasks"><span data-icon="refresh-cw"></span>刷新任务</button></section><div class="signal-strip"><div class="signal-strip__left"><span data-icon="list-checks"></span><strong>${visibleTasks.length} 个任务</strong><span>当前筛选：${state.taskFilter}</span></div><button class="signal-strip__link" type="button" data-nav="home">返回工作台</button></div><section class="task-panel"><div class="section-heading"><div><h2>全部维修任务</h2><span style="display:block;margin-top:3px;color:#7a8c9e;font-size:11px">接单、上门、完成后记得更新状态</span></div></div><div class="task-filter"><button class="filter-button ${state.taskFilter === "全部" ? "is-active" : ""}" data-action="filter-task" data-filter="全部" type="button">全部 ${state.tasks.length}</button><button class="filter-button ${state.taskFilter === "紧急" ? "is-active" : ""}" data-action="filter-task" data-filter="紧急" type="button">紧急 ${state.tasks.filter((task) => task.priority === "紧急").length}</button><button class="filter-button ${state.taskFilter === "待接单" ? "is-active" : ""}" data-action="filter-task" data-filter="待接单" type="button">待接单 ${state.tasks.filter((task) => task.status === "待接单").length}</button><button class="filter-button ${state.taskFilter === "维修中" ? "is-active" : ""}" data-action="filter-task" data-filter="维修中" type="button">维修中 ${state.tasks.filter((task) => task.status === "维修中").length}</button></div><div class="task-list">${visibleTasks.length ? visibleTasks.map(renderTaskCard).join("") : `<div class="empty-state"><span data-icon="circle-check"></span><strong>这个筛选下暂时没有任务</strong><span>可以切换到“全部”查看完整队列。</span></div>`}</div></section>`;
  }

  function renderTaskCard(task) {
    return `<article class="task-card"><span class="task-card__priority task-card__priority--${task.priorityType === "urgent" ? "urgent" : ""}"></span><div><h3>${task.title}</h3><div class="task-card__meta"><span><span data-icon="map-pin"></span>${task.location}</span><span><span data-icon="clock-3"></span>${task.submitted}</span><span>${task.type}</span></div><div class="task-tags"><span class="task-tag task-tag--${task.priorityType === "urgent" ? "urgent" : ""}">${task.priority}</span>${task.tags.map((tag) => `<span class="task-tag">${tag}</span>`).join("")}</div></div><div class="task-card__action"><span class="ticket-state ticket-state--${task.statusType}">${task.status}</span><button class="button button--quiet button--small" style="margin-top:9px" type="button" data-action="open-task" data-task-id="${task.id}">查看任务</button></div></article>`;
  }

  function renderRoutePage() {
    return `<section class="page-head"><div><p class="eyebrow">上门安排</p><h1>今日路线</h1><p>按时间查看今天的上门安排。</p></div><button class="button button--primary" type="button" data-action="open-task" data-task-id="${state.selectedTaskId}"><span data-icon="map"></span>打开当前任务</button></section><div class="tech-layout tech-layout--route"><article class="route-panel"><div class="route-panel__head"><h2>王师傅的路线安排</h2><span>10 月 29 日 · 桂子山校区</span></div><div class="route-list">${data.technician.route.concat([{time:"15:20",title:"材料仓库",note:"补充阀芯和门窗五金",icon:"inbox"}]).map((item) => `<div class="route-item ${item.next ? "is-next" : ""}"><span class="route-dot"><span data-icon="${item.icon}"></span></span><span><strong>${item.time} · ${item.title}</strong><span>${item.note}</span></span></div>`).join("")}</div></article><article class="map-panel"><div class="map-panel__head"><h3>校园位置总览</h3><span>示意路线</span></div><div class="campus-map" style="height:310px"><div class="map-road map-road--a"></div><div class="map-road map-road--b"></div><span class="map-block map-block--1">六栋</span><span class="map-block map-block--2">七栋</span><span class="map-block map-block--3">九栋</span><span class="map-block map-block--4">食堂</span><span class="map-block map-block--5">活动场</span><span class="map-pin" style="top:125px;left:53%"><span data-icon="map-pin"></span></span><span class="map-label" style="top:169px;left:47%">东区八栋 · 302</span></div></article></div>`;
  }

  function renderAnalyticsPage() {
    return `<section class="page-head"><div><p class="eyebrow">工作统计</p><h1>工作统计</h1><p>查看完成量、响应时间和学生评价。</p></div><button class="button button--quiet" type="button" data-action="refresh-tasks"><span data-icon="refresh-cw"></span>更新数据</button></section><div class="metrics-grid"><article class="metric-card metric-card--good"><div class="metric-card__top"><span>本月完成</span><span class="metric-card__icon"><span data-icon="circle-check"></span></span></div><div class="metric-card__value">42</div><div class="metric-card__hint">比上月多完成 8 单</div></article><article class="metric-card"><div class="metric-card__top"><span>平均响应</span><span class="metric-card__icon"><span data-icon="clock-3"></span></span></div><div class="metric-card__value">18<span style="font-size:14px;letter-spacing:0">分钟</span></div><div class="metric-card__hint">从接单到首次联系</div></article><article class="metric-card"><div class="metric-card__top"><span>按时到达</span><span class="metric-card__icon"><span data-icon="route"></span></span></div><div class="metric-card__value">96<span style="font-size:14px;letter-spacing:0">%</span></div><div class="metric-card__hint">近 30 天记录</div></article><article class="metric-card metric-card--urgent"><div class="metric-card__top"><span>平均评分</span><span class="metric-card__icon"><span data-icon="star"></span></span></div><div class="metric-card__value">4.8</div><div class="metric-card__hint">近 30 天 · 31 条评价</div></article></div><div class="subpage-grid"><article class="analytics-panel"><h3>本周完成量</h3><div class="bar-chart" aria-label="本周完成量柱状图"><div class="bar-chart__item"><span style="height:46%"></span><small>一</small><strong>4</strong></div><div class="bar-chart__item"><span style="height:66%"></span><small>二</small><strong>6</strong></div><div class="bar-chart__item"><span style="height:82%"></span><small>三</small><strong>8</strong></div><div class="bar-chart__item is-today"><span style="height:100%"></span><small>四</small><strong>10</strong></div><div class="bar-chart__item"><span style="height:58%"></span><small>五</small><strong>5</strong></div><div class="bar-chart__item"><span style="height:35%"></span><small>六</small><strong>3</strong></div><div class="bar-chart__item"><span style="height:25%"></span><small>日</small><strong>2</strong></div></div></article><article class="info-panel"><h3>学生评价摘要</h3><p>最近反馈集中在响应速度和沟通清晰度。</p><div class="guide-steps"><div class="guide-step"><span class="guide-step__number"><span data-icon="star"></span></span><span><strong>“到得很快”</strong><span>12 条评价提到上门及时。</span></span></div><div class="guide-step"><span class="guide-step__number"><span data-icon="message-square-text"></span></span><span><strong>“解释得清楚”</strong><span>8 条评价提到维修说明。</span></span></div><div class="guide-step"><span class="guide-step__number"><span data-icon="wrench"></span></span><span><strong>擅长类型</strong><span>水电维修 · 门窗五金。</span></span></div></div></article></div>`;
  }

  function openModal(type, payload = {}) {
    let content = "";
    if (type === "repair") content = repairModal();
    if (type === "ticket") content = ticketModal();
    if (type === "complete") content = completeModal();
    if (type === "task") content = taskModal(payload.taskId);
    if (type === "exception") content = exceptionModal(payload.taskId);
    if (type === "notifications") content = notificationsModal();
    if (type === "guide") content = guideModal();
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="${type}" data-modal-content>${content}</section></div>`;
    window.hydrateIcons(modalRoot);
    const focusable = modalRoot.querySelector("button, input, textarea, select");
    if (focusable) focusable.focus();
  }

  function repairModal() {
    return `<div class="modal__head"><div><h2>提交一条新报修</h2><p>补充地点和照片，师傅更容易找到问题。</p></div><button class="modal__close" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal__body"><div class="stepper" aria-label="报修流程"><span class="is-active" title="填写信息"></span><span class="is-active" title="确认提交"></span><span title="等待处理"></span></div><div class="stepper-labels" aria-hidden="true"><span>填写信息</span><span>确认提交</span><span>等待处理</span></div><form id="repairForm"><div class="form-grid"><div class="field field--full"><label for="repairLocation">报修地点 <span>*</span></label><input id="repairLocation" name="location" value="东区八栋 · 302" required /><span class="field__helper">支持宿舍楼、教学楼和公共区域，例如“南湖13栋 · 408”。</span></div><div class="field"><label for="repairType">故障类型 <span>*</span></label><select id="repairType" name="type"><option>水电维修</option><option>门窗维修</option><option>桌椅设施</option><option>空调设备</option><option>网络设备</option><option>公共设施</option><option>其他问题</option></select></div><div class="field"><label for="repairTime">可维修时间 <span>*</span></label><select id="repairTime" name="time"><option>今天 10:00 - 12:00</option><option>今天 14:00 - 17:00</option><option>今天 19:00 - 21:00</option><option>明天 09:00 - 12:00</option></select></div><div class="field field--full"><label for="repairDescription">故障描述 <span>*</span></label><textarea id="repairDescription" name="description" required placeholder="请描述哪里坏了、是否影响正常使用……">水龙头持续滴漏，关紧后仍有少量漏水。</textarea></div><div class="field field--full"><label for="repairPhotos">现场照片</label><input id="repairPhotos" name="photos" type="file" accept="image/png,image/jpeg" multiple hidden /><button class="upload-box" type="button" data-action="choose-photos"><span data-icon="image"></span><span class="upload-box__copy">选择现场照片<br /><small>支持 JPG、PNG，最多 3 张</small></span></button><span class="field__helper" id="repairPhotosHint">照片会随工单一起提供给维修师傅。</span></div><div class="field"><label for="repairName">联系人</label><input id="repairName" name="name" value="任文康" /></div><div class="field"><label for="repairPhone">联系电话</label><input id="repairPhone" name="phone" value="138 7112 0348" type="tel" /></div></div></form></div><div class="modal__footer"><button class="button button--quiet" type="button" data-action="close-modal">取消</button><button class="button button--primary" type="submit" form="repairForm"><span data-icon="send"></span>确认提交</button></div>`;
  }

  function ticketModal() {
    const ticket = state.studentTicket;
    return `<div class="modal__head"><div><h2>${ticket.title}</h2><p>${ticket.id} · ${ticket.location}</p></div><button class="modal__close" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal__body"><div class="review-block" style="margin-bottom:18px"><div class="review-line"><span>当前状态</span><strong style="color:#0b8f83">${ticket.status}</strong></div><div class="review-line"><span>维修人员</span><strong>${ticket.tech} · ${ticket.techPhone}</strong></div><div class="review-line"><span>预计上门</span><strong>${ticket.eta}</strong></div><div class="review-line"><span>已等待</span><strong>${ticket.wait}</strong></div></div><div class="modal-timeline">${ticket.timeline.map((step) => `<div class="modal-timeline__item ${step.done || step.current ? "is-done" : ""}"><i class="modal-timeline__dot"></i><span><strong>${step.label}</strong><span>${step.note}</span></span><time class="modal-timeline__time">${step.time}</time></div>`).join("")}</div></div><div class="modal__footer"><button class="button button--quiet" type="button" data-action="close-modal">关闭</button>${ticket.status === "已完成" ? `<button class="button button--primary" type="button" data-action="open-complete"><span data-icon="star"></span>确认结果并评价</button>` : ""}</div>`;
  }

  function completeModal() {
    return `<div class="modal__head"><div><h2>确认维修结果</h2><p>检查现场后再确认，问题仍存在可以反馈给后勤中心。</p></div><button class="modal__close" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal__body"><div class="review-block" style="margin-bottom:18px"><div class="review-line"><span>维修结果</span><strong>已更换水龙头阀芯</strong></div><div class="review-line"><span>维修人员</span><strong>王师傅 · 10:47 完成</strong></div></div><div class="rating-group"><label>维修速度</label><div class="rating-buttons" data-rating-group="speed">${[1,2,3,4,5].map((n) => `<button type="button" class="rating-button ${n === 5 ? "is-active" : ""}" data-action="rate" data-value="${n}">${n}</button>`).join("")}</div></div><div class="rating-group" style="margin-top:16px"><label>维修质量</label><div class="rating-buttons" data-rating-group="quality">${[1,2,3,4,5].map((n) => `<button type="button" class="rating-button ${n === 5 ? "is-active" : ""}" data-action="rate" data-value="${n}">${n}</button>`).join("")}</div></div><div class="field" style="margin-top:16px"><label for="reviewText">补充评价（选填）</label><textarea id="reviewText" placeholder="说说这次服务哪里让你满意……"></textarea></div></div><div class="modal__footer"><button class="button button--quiet" type="button" data-action="report-problem">问题仍未解决</button><button class="button button--primary" type="button" data-action="confirm-complete"><span data-icon="circle-check"></span>确认完成并提交评价</button></div>`;
  }

  function taskModal(taskId) {
    const task = state.tasks.find((item) => item.id === taskId) || state.tasks[0];
    const isDone = task.status === "已完成";
    const actionMap = { "待接单": ["accept-task", "接单"], "已接单": ["start-route", "开始前往"], "待上门": ["arrive-task", "已到达"], "已到达": ["start-repair", "开始维修"], "维修中": ["finish-task", "维修完成"] };
    const action = actionMap[task.status];
    return `<div class="modal__head"><div><h2>${task.title}</h2><p>${task.id} · ${task.location}</p></div><button class="modal__close" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal__body"><div class="task-tags" style="margin:0 0 15px"><span class="task-tag task-tag--${task.priorityType === "urgent" ? "urgent" : ""}">${task.priority}</span><span class="task-tag">${task.type}</span><span class="task-tag">${task.status}</span></div><div class="review-block"><div class="review-line"><span>报修地点</span><strong>${task.location}</strong></div><div class="review-line"><span>联系人</span><strong>${task.contact}</strong></div><div class="review-line"><span>推荐上门</span><strong>${task.eta}</strong></div><div class="review-line"><span>建议材料</span><strong>${task.material}</strong></div></div><div class="field" style="margin-top:16px"><label>学生描述</label><div style="padding:12px;color:#50647a;background:#f6f8fa;border:1px solid #dce5ed;border-radius:9px;font-size:12px">${task.description}</div></div></div><div class="modal__footer"><button class="button button--danger" type="button" data-action="open-exception" data-task-id="${task.id}"><span data-icon="alert-triangle"></span>异常上报</button><button class="button button--quiet" type="button" data-action="close-modal">关闭</button>${action ? `<button class="button button--primary" type="button" data-action="task-transition" data-task-id="${task.id}" data-transition="${action[0]}"><span data-icon="${action[0] === "finish-task" ? "circle-check" : "arrow-up-right"}"></span>${action[1]}</button>` : isDone ? `<button class="button button--secondary" type="button" data-action="open-ticket"><span data-icon="file-clock"></span>查看学生端</button>` : ""}</div>`;
  }

  function exceptionModal(taskId) {
    return `<div class="modal__head"><div><h2>上报异常情况</h2><p>任务会保留在队列中，后勤中心会根据原因重新安排。</p></div><button class="modal__close" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal__body"><form id="exceptionForm"><div class="field"><label for="exceptionType">异常原因 <span>*</span></label><select id="exceptionType"><option>缺少维修材料</option><option>需要转派专业人员</option><option>用户不在现场</option><option>报修信息错误</option><option>其他</option></select></div><div class="field" style="margin-top:15px"><label for="exceptionNote">补充说明</label><textarea id="exceptionNote" placeholder="请写清楚下一步需要后勤中心做什么……"></textarea></div></form></div><div class="modal__footer"><button class="button button--quiet" type="button" data-action="close-modal">取消</button><button class="button button--primary" type="button" data-action="submit-exception" data-task-id="${taskId}"><span data-icon="send"></span>发送异常上报</button></div>`;
  }

  function notificationsModal() {
    return `<div class="modal__head"><div><h2>消息通知</h2><p>关键状态变化会自动同步给你。</p></div><button class="modal__close" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal__body"><div class="notice-list">${data.student.notices.slice(0, 3).map((notice, index) => `<button class="notice-item ${notice.read ? "is-read" : ""}" type="button" data-action="read-notice" data-notice-index="${index}"><i class="notice-item__dot"></i><span><strong>${notice.title}</strong><span>${notice.body}</span></span><time>${notice.time}</time></button>`).join("")}</div></div><div class="modal__footer"><button class="button button--quiet" type="button" data-action="close-modal">关闭</button><button class="button button--primary" type="button" data-action="open-notices-page">查看全部通知</button></div>`;
  }

  function guideModal() {
    return `<div class="modal__head"><div><h2>报修小贴士</h2><p>地点、照片和电话填写完整，师傅才能更快处理。</p></div><button class="modal__close" type="button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div><div class="modal__body"><div class="guide-steps"><div class="guide-step"><span class="guide-step__number">1</span><span><strong>地点写到楼栋和房间</strong><span>例如：东区八栋 · 302，而不是只写“宿舍”。</span></span></div><div class="guide-step"><span class="guide-step__number">2</span><span><strong>照片拍清故障位置</strong><span>水渍、断裂、设备编号等细节很有帮助。</span></span></div><div class="guide-step"><span class="guide-step__number">3</span><span><strong>保持电话可接通</strong><span>师傅到达前会通过电话或消息联系你。</span></span></div><div class="guide-step"><span class="guide-step__number">4</span><span><strong>检查后再点完成</strong><span>问题没有解决时，选择“问题仍未解决”。</span></span></div></div></div><div class="modal__footer"><button class="button button--primary" type="button" data-action="close-modal">知道了</button></div>`;
  }

  function closeModal() { modalRoot.innerHTML = ""; }

  function toast(title, message, icon = "circle-check") {
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<span data-icon="${icon}"></span><span><strong>${title}</strong><span>${message}</span></span>`;
    toastRegion.appendChild(node);
    window.hydrateIcons(node);
    window.setTimeout(() => node.remove(), 4300);
  }

  function updateTaskStatus(taskId, transition) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const next = { "accept-task": "已接单", "start-route": "待上门", "arrive-task": "已到达", "start-repair": "维修中", "finish-task": "已完成" }[transition];
    if (!next) return;
    task.status = next;
    task.statusType = next === "已完成" ? "done" : "active";
    task.updatedAt = Date.now();
    if (task.id === state.studentTicket.id) {
      // 师傅端的“已到达”对应学生端时间轴里的“待上门”节点。
      const currentIndex = statusLabels.indexOf(next === "已到达" ? "待上门" : next);
      state.studentTicket.status = next;
      state.studentTicket.timeline = state.studentTicket.timeline.map((step, index) => ({ ...step, done: index < currentIndex, current: index === currentIndex }));
      if (next === "已完成") state.studentTicket.timeline[state.studentTicket.timeline.length - 1].done = true;
    }
    saveSharedData();
    closeModal();
    renderApp();
    toast("状态已更新", `任务已标记为“${next}”，学生端会同步收到通知。`);
  }

  document.addEventListener("click", (event) => {
    const authModeButton = event.target.closest("[data-auth-mode]");
    if (authModeButton && !isAuthenticated) {
      authState.mode = authModeButton.dataset.authMode;
      authState.error = "";
      renderAuth();
      return;
    }
    const authRoleButton = event.target.closest("[data-auth-role]");
    if (authRoleButton && !isAuthenticated) {
      authState.role = authRoleButton.dataset.authRole;
      authState.error = "";
      renderAuth();
      return;
    }
    const roleButton = event.target.closest("[data-role]");
    if (roleButton) {
      if (isAuthenticated) {
        if (roleButton.dataset.role !== state.role) toast("账号角色已锁定", "请退出当前账号后，再登录另一类账号。", "info");
        return;
      }
      state.role = roleButton.dataset.role;
      state.activeNav = "home";
      setTabRole(state.role);
      renderApp();
      toast("已切换角色", state.role === "student" ? "现在是学生端视图。" : "现在是维修师傅端视图。", "refresh-cw");
      return;
    }
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      event.preventDefault();
      state.activeNav = nav.dataset.nav;
      if (state.role === "technician" && state.activeNav === "home") state.taskFilter = "全部";
      window.history.replaceState(null, "", `#${state.activeNav}`);
      renderApp();
      return;
    }
    const actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    const action = actionNode.dataset.action;
    if (action === "forgot-password") {
      authState.error = "演示环境不发送真实邮件，请使用页面提示的演示账号。";
      renderAuth();
      return;
    }
    if (action === "logout") {
      isAuthenticated = false;
      setTabMeta({ authenticated: false });
      authState.mode = "login";
      authState.role = state.role;
      authState.error = "";
      renderAuth();
      return;
    }
    if (action === "close-modal") {
      if (event.target.closest("[data-modal-content]") && !event.target.closest(".modal__close") && !event.target.closest(".modal__footer [data-action='close-modal']")) return;
      closeModal();
    }
    if (action === "open-repair") openModal("repair");
    if (action === "open-ticket") openModal("ticket");
    if (action === "open-complete") openModal("complete");
    if (action === "open-task") openModal("task", { taskId: actionNode.dataset.taskId });
    if (action === "open-exception") openModal("exception", { taskId: actionNode.dataset.taskId });
    if (action === "open-notifications") openModal("notifications");
    if (action === "open-guide") openModal("guide");
    if (action === "show-support") toast("后勤服务中心", "联系电话：027 6786 1000（桂子山、南湖校区）", "phone");
    if (action === "choose-photos") document.getElementById("repairPhotos")?.click();
    if (action === "open-records") { state.activeNav = "records"; renderApp(); }
    if (action === "toggle-records") { state.recordsExpanded = !state.recordsExpanded; renderApp(); }
    if (action === "open-notices-page") { closeModal(); state.activeNav = "notices"; renderApp(); }
    if (action === "scan") toast("扫码报修已开启", "演示模式已自动识别为“东区八栋 · 302”。", "scan-line");
    if (action === "nudge") {
      if (state.studentTicket.nudged) return;
      state.studentTicket.nudged = true;
      saveSharedData();
      renderApp();
      toast("催单已发送", "后勤中心已收到提醒，请耐心等待师傅处理。", "megaphone");
    }
    if (action === "filter-task") { state.taskFilter = actionNode.dataset.filter; renderApp(); }
    if (action === "refresh-tasks") toast("任务已刷新", "已同步最新的任务状态。", "refresh-cw");
    if (action === "task-transition") updateTaskStatus(actionNode.dataset.taskId, actionNode.dataset.transition);
    if (action === "submit-exception") {
      closeModal();
      toast("异常已上报", "后勤中心已收到处理请求，任务会保留在队列中。", "alert-triangle");
    }
    if (action === "confirm-complete") {
      state.studentTicket.status = "已完成";
      state.studentTicket.timeline = state.studentTicket.timeline.map((step, index) => ({ ...step, done: true, current: false, time: index === 6 ? "刚刚" : step.time }));
      saveSharedData();
      closeModal();
      renderApp();
      toast("评价已提交", "感谢你的反馈，这条工单已完成归档。", "star");
    }
    if (action === "report-problem") { closeModal(); toast("已记录反馈", "后勤中心会重新联系你确认现场情况。", "message-square-text"); }
    if (action === "rate") {
      const group = actionNode.closest("[data-rating-group]");
      group.querySelectorAll(".rating-button").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.value) <= Number(actionNode.dataset.value)));
    }
    if (action === "mark-all-read") {
      data.student.notices.forEach((notice) => { notice.read = true; });
      state.unread = 0;
      renderApp();
      toast("通知已读", "所有通知已标记为已读。", "check");
    }
    if (action === "read-notice") {
      const index = Number(actionNode.dataset.noticeIndex);
      if (data.student.notices[index] && !data.student.notices[index].read) { data.student.notices[index].read = true; state.unread = Math.max(0, state.unread - 1); }
      closeModal();
      if (state.activeNav === "notices") renderApp();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id !== "repairPhotos") return;
    const hint = document.getElementById("repairPhotosHint");
    const files = [...(event.target.files || [])];
    if (hint) hint.textContent = files.length ? `已选择 ${files.length} 张照片：${files.map((file) => file.name).join("、")}` : "照片会随工单一起提供给维修师傅。";
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "authForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const account = String(form.get("account")).trim();
      const password = String(form.get("password"));
      if (authState.mode === "register") {
        const confirm = String(form.get("passwordConfirm"));
        if (password.length < 6) { authState.error = "密码至少需要 6 位字符。"; renderAuth(); return; }
        if (password !== confirm) { authState.error = "两次输入的密码不一致，请重新确认。"; renderAuth(); return; }
        accounts[authState.role] = { account, password, name: String(form.get("name")).trim(), subtitle: authState.role === "student" ? "华中师范大学 · 学生账号" : "校园维修服务 · 维修账号" };
        localStorage.setItem("ccnu-demo-accounts", JSON.stringify(accounts));
        authState.error = "";
        isAuthenticated = true;
        setTabMeta({ role: authState.role, authenticated: true });
        state.role = authState.role;
        setTabRole(state.role);
        renderAuth();
        renderApp();
        toast("注册成功", `已进入${state.role === "student" ? "学生端" : "维修师傅端"}。`, "circle-check");
        return;
      }
      const registered = accounts[authState.role];
      const accountMatches = account === registered.account || (authState.role === "student" && account === "2024214334") || (authState.role === "technician" && account.toUpperCase() === "WX-018");
      if (!accountMatches || password !== registered.password) {
        authState.error = `账号或密码不正确，请检查${authState.role === "student" ? "学号/校园邮箱" : "工号/维修账号"}。`;
        renderAuth();
        return;
      }
      isAuthenticated = true;
      setTabMeta({ role: authState.role, authenticated: true });
      state.role = authState.role;
      setTabRole(state.role);
      renderAuth();
      renderApp();
      toast("登录成功", `欢迎进入${state.role === "student" ? "学生端" : "维修师傅端"}。`, "circle-check");
      return;
    }
    if (event.target.id !== "repairForm") return;
    event.preventDefault();
    const form = new FormData(event.target);
    const newTicketId = `WX-20261029-${Math.floor(1000 + Math.random() * 8999)}`;
    const description = String(form.get("description"));
    state.studentTicket = { ...state.studentTicket, id: newTicketId, title: `${form.get("type")} · ${description.slice(0, 16)}…`, type: form.get("type"), location: form.get("location"), submitted: "刚刚", status: "已提交", eta: "待派单", wait: "0 分钟", nudged: false, timeline: statusLabels.map((label, index) => ({ label, time: index === 0 ? "刚刚" : "--", note: index === 0 ? "报修资料已提交，等待后勤受理" : "等待前序状态完成", done: index === 0, current: index === 0 })) };
    const newTask = { id: newTicketId, title: state.studentTicket.title, location: state.studentTicket.location, type: state.studentTicket.type, submitted: "刚刚", priority: "普通", priorityType: "normal", status: "待接单", statusType: "wait", tags: [state.studentTicket.type, "学生上传"], contact: `${form.get("name")} · ${form.get("phone")}`, description, eta: "待派单", material: "待后勤确认", updatedAt: Date.now() };
    state.tasks = removeDuplicateTasks([newTask, ...state.tasks.filter((task) => task.id !== newTicketId)]);
    state.selectedTaskId = newTask.id;
    saveSharedData();
    closeModal();
    state.activeNav = "home";
    renderApp();
    toast("报修提交成功", `工单 ${state.studentTicket.id} 已创建，后勤中心会尽快受理。`, "send");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalRoot.innerHTML) closeModal();
    if ((event.key === "Enter" || event.key === " ") && event.target.closest("#profileChip")) {
      event.preventDefault();
      event.target.closest("#profileChip").click();
    }
  });

  window.addEventListener("hashchange", () => {
    syncRouteFromHash();
    renderApp();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === sharedKeys.tasks || event.key === sharedKeys.ticket) syncSharedData(true, event.key === sharedKeys.tasks);
  });

  if (sharedChannel) {
    sharedChannel.addEventListener("message", (event) => {
      if (event.data?.type !== "shared-data") return;
      const incomingTasks = Array.isArray(event.data.tasks) ? event.data.tasks : null;
      const incomingTicket = event.data.studentTicket;
      const tasksChanged = incomingTasks && JSON.stringify(incomingTasks) !== JSON.stringify(state.tasks);
      const ticketChanged = incomingTicket && JSON.stringify(incomingTicket) !== JSON.stringify(state.studentTicket);
      if (incomingTasks) state.tasks = incomingTasks;
      if (incomingTicket && typeof incomingTicket === "object") state.studentTicket = incomingTicket;
      if (isAuthenticated && (tasksChanged || ticketChanged)) renderApp();
      if (tasksChanged && state.role === "technician") toast("收到新报修", "学生端刚刚提交了一条新的维修任务。", "bell");
      if (ticketChanged && state.role === "student") toast("工单状态更新", `当前状态：${state.studentTicket.status}。`, "refresh-cw");
    });
  }

  window.addEventListener("focus", () => syncSharedData(true, false));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncSharedData(true, false);
  });

  syncRouteFromHash();
  renderAuth();
  if (isAuthenticated) renderApp();
})();






