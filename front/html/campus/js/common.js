// let commonURL = "http://192.168.50.115:8081";
let commonURL = "/api";
// 设置后台服务地址
axios.defaults.baseURL = commonURL;
axios.defaults.timeout = 2000;
const publicPagePaths = new Set([
  "/login.html",
  "/login2.html"
]);
const currentPagePath = window.location.pathname;
const tokenStorageKey = "token";
const userStorageKey = "currentUser";
const persistedToken = localStorage.getItem(tokenStorageKey);
const sessionToken = sessionStorage.getItem(tokenStorageKey);
if (persistedToken && !sessionToken) {
  sessionStorage.setItem(tokenStorageKey, persistedToken);
}
if (!persistedToken && sessionToken) {
  localStorage.setItem(tokenStorageKey, sessionToken);
}
window.auth = {
  getToken() {
    return localStorage.getItem(tokenStorageKey) || sessionStorage.getItem(tokenStorageKey);
  },
  setToken(value) {
    if (value) {
      localStorage.setItem(tokenStorageKey, value);
      sessionStorage.setItem(tokenStorageKey, value);
    }
  },
  clearToken() {
    localStorage.removeItem(tokenStorageKey);
    sessionStorage.removeItem(tokenStorageKey);
  },
  getUser() {
    const raw = localStorage.getItem(userStorageKey) || sessionStorage.getItem(userStorageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      localStorage.removeItem(userStorageKey);
      sessionStorage.removeItem(userStorageKey);
      return null;
    }
  },
  setUser(user) {
    if (!user) return;
    const raw = JSON.stringify(user);
    localStorage.setItem(userStorageKey, raw);
    sessionStorage.setItem(userStorageKey, raw);
  },
  clearUser() {
    localStorage.removeItem(userStorageKey);
    sessionStorage.removeItem(userStorageKey);
  }
};
// request拦截器，将用户token放入头中
let token = window.auth.getToken();
if (!token && !publicPagePaths.has(currentPagePath)) {
  location.replace("/login.html");
}
axios.interceptors.request.use(
  config => {
    token = window.auth.getToken();
    if(token) config.headers['authentication'] = token
    return config
  },
  error => {
    console.log(error)
    return Promise.reject(error)
  }
)
axios.interceptors.response.use(function (response) {
  // 判断执行结果
  if (!response.data.success) {
    return Promise.reject(response.data.errorMsg)
  }
  return response.data;
}, function (error) {
  // 一般是服务端异常或者网络异常
  console.log(error)
  if(error.response && error.response.status == 401){
    window.auth.clearUser();
    // 未登录，跳转
    setTimeout(() => {
      location.href = "/login.html"
    }, 200);
    return Promise.reject("请先登录");
  }
  return Promise.reject("服务器异常");
});
axios.defaults.paramsSerializer = function(params) {
  let p = "";
  Object.keys(params).forEach(k => {
    if(params[k]){
      p = p + "&" + k + "=" + params[k]
    }
  })
  return p;
}
window.notifyToast = function(message, type, offset) {
  if (!message) return;
  if (window.ELEMENT && window.ELEMENT.Message && typeof window.ELEMENT.Message.closeAll === 'function') {
    window.ELEMENT.Message.closeAll();
  }
  if (window.ELEMENT && window.ELEMENT.Message) {
    window.ELEMENT.Message({
      message: message,
      type: type || 'info',
      duration: 1500,
      showClose: false,
      offset: typeof offset === 'number' ? offset : 96
    });
  } else if (window.console && console.log) {
    console.log(message);
  }
};
const util = {
  commonURL,
  buildWsUrl(path, params) {
    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const base = protocol + location.host + path;
    const query = params ? Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&') : '';
    return query ? base + '?' + query : base;
  },
  getUrlParam(name) {
    let reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    let r = window.location.search.substr(1).match(reg);
    if (r != null) {
      return decodeURI(r[2]);
    }
    return "";
  },
  buildCurrentUrl(overrides) {
    const url = new URL(window.location.href);
    const params = overrides || {};
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value === undefined || value === null || value === '') {
        url.searchParams.delete(key);
        return;
      }
      url.searchParams.set(key, value);
    });
    return url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash;
  },
  syncCurrentUrl(overrides) {
    const next = this.buildCurrentUrl(overrides);
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', next);
    }
    return next;
  },
  buildReturnUrl(overrides) {
    return encodeURIComponent(this.buildCurrentUrl(overrides));
  },
  goBack(fallback) {
    const returnUrl = this.getUrlParam('returnUrl');
    if (returnUrl) {
      location.href = decodeURIComponent(returnUrl);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    location.href = fallback || '/index.html';
  },
  formatPrice(val) {
    if (typeof val === 'string') {
      if (isNaN(val)) {
        return null;
      }
      // 价格转为整数
      const index = val.lastIndexOf(".");
      let p = "";
      if (index < 0) {
        // 无小数
        p = val + "00";
      } else if (index === p.length - 2) {
        // 1位小数
        p = val.replace("\.", "") + "0";
      } else {
        // 2位小数
        p = val.replace("\.", "")
      }
      return parseInt(p);
    } else if (typeof val === 'number') {
      if (!val) {
        return null;
      }
      const s = val + '';
      if (s.length === 0) {
        return "0.00";
      }
      if (s.length === 1) {
        return "0.0" + val;
      }
      if (s.length === 2) {
        return "0." + val;
      }
      const i = s.indexOf(".");
      if (i < 0) {
        return s.substring(0, s.length - 2) + "." + s.substring(s.length - 2)
      }
      const num = s.substring(0, i) + s.substring(i + 1);
      if (i === 1) {
        // 1位整数
        return "0.0" + num;
      }
      if (i === 2) {
        return "0." + num;
      }
      if (i > 2) {
        return num.substring(0, i - 2) + "." + num.substring(i - 2)
      }
    }
  }
}

window.notificationClient = {
  socket: null,
  reconnectTimer: null,
  heartbeatTimer: null,
  reconnectDelay: 3000,
  listeners: [],
  unreadCount: 0,
  storageKey: 'campus_notification_unread_count',
  normalizeUnread(count) {
    const value = Number(count);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  },
  persistUnread(count) {
    try {
      window.localStorage.setItem(this.storageKey, String(this.normalizeUnread(count)));
    } catch (e) {}
  },
  restoreUnread() {
    try {
      return this.normalizeUnread(window.localStorage.getItem(this.storageKey));
    } catch (e) {
      return 0;
    }
  },
  setUnreadCount(count, silent) {
    this.unreadCount = this.normalizeUnread(count);
    this.persistUnread(this.unreadCount);
    if (!silent) {
      this.emitUnread(this.unreadCount);
    }
    return this.unreadCount;
  },
  syncUnreadFromStorage() {
    return this.setUnreadCount(this.restoreUnread());
  },
  fetchUnread() {
    if (!window.auth.getToken()) return Promise.resolve(0);
    return axios.get('/notification/unread-count')
      .then(({data}) => {
        return this.setUnreadCount(data, true);
      })
      .catch(() => 0);
  },
  connect(options) {
    const token = window.auth.getToken();
    if (options) this.addListener(options);
    if (!token) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const url = util.buildWsUrl('/api/ws/notification', { token });
    try {
      this.socket = new WebSocket(url);
      this.socket.onopen = () => {
        this.startHeartbeat();
        this.fetchUnread().then(count => this.emitUnread(count));
      };
      this.socket.onmessage = (event) => {
        if (event.data === 'pong') return;
        let message = null;
        try {
          message = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (typeof message.unreadCount === 'number') {
          this.setUnreadCount(message.unreadCount);
        }
        this.emitMessage(message);
      };
      this.socket.onerror = () => {
        this.closeSocketOnly();
        this.scheduleReconnect();
      };
      this.socket.onclose = () => {
        this.closeSocketOnly();
        this.scheduleReconnect();
      };
    } catch (e) {
      this.socket = null;
      this.scheduleReconnect();
    }
  },
  addListener(options) {
    if (!options) return;
    const exists = this.listeners.some(item => item && item.owner === options.owner);
    if (options.owner && exists) return;
    this.listeners.push(options);
  },
  removeListener(owner) {
    if (!owner) return;
    this.listeners = this.listeners.filter(item => !item || item.owner !== owner);
  },
  emitMessage(message) {
    this.listeners.forEach(item => {
      if (item && item.onMessage) item.onMessage(message);
    });
  },
  emitUnread(count) {
    this.listeners.forEach(item => {
      if (item && item.onUnread) item.onUnread(count);
      if (item && item.onUnreadChange) item.onUnreadChange(count);
    });
  },
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.closeSocketOnly();
        this.scheduleReconnect();
        return;
      }
      try {
        this.socket.send('ping');
      } catch (e) {
        this.closeSocketOnly();
        this.scheduleReconnect();
      }
    }, 25000);
  },
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  },
  scheduleReconnect() {
    if (this.reconnectTimer || !window.auth.getToken()) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
  },
  closeSocketOnly() {
    this.stopHeartbeat();
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.onclose = null;
      socket.onerror = null;
      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      } catch (e) {}
    }
  },
  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocketOnly();
  }
};

window.addEventListener('storage', event => {
  if (event.key === window.notificationClient.storageKey) {
    window.notificationClient.syncUnreadFromStorage();
  }
});
window.addEventListener('pageshow', () => window.notificationClient.syncUnreadFromStorage());
window.addEventListener('online', () => window.notificationClient.connect());
window.addEventListener('focus', () => window.notificationClient.connect());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) window.notificationClient.connect();
});
