Vue.component("footBar", {
  template: `
    <div class="foot">
      <div class="foot-box" :class="{active: activeBtn === 1}" @click="toPage(1)">
        <div class="foot-view"><i class="el-icon-s-home"></i></div>
        <div class="foot-text">活动</div>
      </div>
      <div v-if="showCreateEntry" class="foot-box" :class="{active: activeBtn === 2}" @click="toPage(2)">
        <div class="foot-view"><i class="el-icon-circle-plus-outline"></i></div>
        <div class="foot-text">发起</div>
      </div>
      <div class="foot-box" :class="{active: activeBtn === 3}" @click="toPage(3)">
        <div class="foot-view"><i class="el-icon-user"></i></div>
        <div class="foot-text">我的</div>
      </div>
    </div>
  `,
  props: ['activeBtn'],
  data() {
    return {
      showCreateEntry: true
    }
  },
  created() {
    const token = window.auth.getToken();
    if (!token) {
      return;
    }
    axios.get('/user/me')
      .then(({data}) => {
        window.auth.setUser(data || {});
        this.showCreateEntry = !data || data.roleType !== 2;
      })
      .catch(() => {
        this.showCreateEntry = true;
      });
  },
  methods: {
    toPage(i) {
      if (i === 1) {
        location.href = "/index.html";
      } else if (i === 2) {
        location.href = "/activity-manage.html";
      } else if (i === 3) {
        location.href = "/info.html";
      }
    }
  }
})
