Page({
  data: {url: ''},
  onLoad(options) {
    const app = getApp();
    wx.request({url: app.globalData.apiBase + '/api/session', success: session => { wx.request({url: app.globalData.apiBase + '/api/workbench/state', header: {'X-Local-CSRF': session.data.token}, success: response => {
      const topic = response.data?.state?.library?.topics?.find(item => item.id === decodeURIComponent(options.topic || ''));
      const bvid = topic?.items?.[0];
      if (bvid) this.setData({url: 'https://www.bilibili.com/video/' + bvid});
    }}); }});
  }
});
