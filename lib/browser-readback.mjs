export function acceptReadbackPage(previous, input, now = new Date().toISOString()) {
  if (!input || input.source !== 'authorized_browser_readback' || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.scanId || '') ||
      !Number.isInteger(input.reportedTotal) || input.reportedTotal < 0 || !Number.isInteger(input.expectedPages) || input.expectedPages < 1 || input.expectedPages > 10000 ||
      !Number.isInteger(input.page) || input.page < 1 || input.page > input.expectedPages || input.renderedPage !== input.page || !Array.isArray(input.items)) throw Error('invalid_readback_evidence');
  if (previous && (previous.scanId !== input.scanId || previous.reportedTotal !== input.reportedTotal || previous.expectedPages !== input.expectedPages)) throw Error('scan_identity_or_total_changed');
  if (input.items.some(item => !/^BV[0-9a-zA-Z]{10}$/.test(item?.bvid || ''))) throw Error('invalid_readback_bvid');
  const ids = input.items.map(item => item.bvid);
  if (new Set(ids).size !== ids.length) throw Error('duplicate_cards_in_page');
  for (const [page, value] of Object.entries(previous?.pages || {})) {
    if (Number(page) !== input.page && ids.length && JSON.stringify(value.items.map(item => item.bvid)) === JSON.stringify(ids)) throw Error('page_content_not_advanced');
  }
  return {...previous,version:2,scanId:input.scanId,source:input.source,reportedTotal:input.reportedTotal,expectedPages:input.expectedPages,capturedAt:now,scanComplete:false,paginationStable:false,
    pages:{...previous?.pages,[input.page]:{capturedAt:now,items:input.items.map(item=>({bvid:item.bvid,title:typeof item.title==='string'?item.title.slice(0,1000):'',url:'https://www.bilibili.com/video/'+item.bvid}))}}};
}
