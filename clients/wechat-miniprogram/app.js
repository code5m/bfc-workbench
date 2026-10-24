App({
  globalData: {apiBase: 'https://YOUR-HTTPS-DOMAIN.example.com'},
  onLaunch() { this.globalData.apiBase = wx.getStorageSync('apiBase') || this.globalData.apiBase; }
});
