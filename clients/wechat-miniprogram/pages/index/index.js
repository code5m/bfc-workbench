Page({
  data: {topics: [], loading: true, error: ''},
  onLoad() {
    const app = getApp();
    wx.request({url: app.globalData.apiBase + '/api/session', success: session => { wx.request({url: app.globalData.apiBase + '/api/workbench/state', header: {'X-Local-CSRF': session.data.token}, success: response => {
      const state = response.data?.state;
      this.setData({topics: state?.library?.topics || [], loading: false});
    }, fail: () => this.setData({loading: false, error: '服务端不可用，请检查 HTTPS 域名配置。'})}); }, fail: () => this.setData({loading: false, error: '无法建立所有者会话。'})});
  },
  openTopic(event) { wx.navigateTo({url: '/pages/webview/webview?topic=' + encodeURIComponent(event.currentTarget.dataset.id)}); }
});
