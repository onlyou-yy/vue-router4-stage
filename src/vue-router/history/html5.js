function buildState(back,current,forward,replace = false,computedScroll = false){
  return {
    back,
    current,
    forward,
    replace,
    scroll:computedScroll ? {left:window.pageXOffset,top:window.pageYOffset} : null,
    position:window.history.length - 1
  }
}

function createCurrentLocation(base){
  const {pathname,search,hash} = window.location;

  const hasPos = base.indexOf("#");//vue-router4 不考虑 hash 模式。只是将 /about => #/about
  if(hasPos >  -1){
    return base.slice(1) || "/";
  }

  return pathname + search + hash;
}

function useHistoryStateNavigation(base){
  const currentLocation = {
    value:createCurrentLocation(base),
  }
  const historyState = {
    value:window.history.state
  }
  // 第一次刷新页面，此时没有任何状态，那么我就自己维护一个状态（后退后是那个路径，当前路径是哪个，要去哪里，用的是push还是replace跳转，跳转后滚动条位置是哪）
  if(!historyState.value){
    changeLocation(currentLocation.value,buildState(null,currentLocation.value,null,true),true);
  }
  function changeLocation(to,state,replace){
    const hasPos = base.indexOf("#");
    const url = hasPos > -1 ? base + to : to;

    window.history[replace ? 'replaceState':'pushState'](state,null,url)
    historyState.value = state;//将自己生成状态同步到路由系统中
  }

  //去哪，状态是什么
  function push(to,data){
    // 需要维护两个状态，跳转前，跳转后，因为跳转之后还可能需要返回
    // 所以先将当前的状态同步到history中，以保存当前的状态，方便返回后还原，和之后的前进
    // 跳转前
    const currentState = Object.assign(
      {},
      historyState.value,//当前状态
      {forward:to,scroll:{left:window.pageXOffset,top:window.pageYOffset}}
    )
    //实际上并没有跳转，只是更新了状态，之后可以在vue中监听变化
    changeLocation(currentState.current,currentState,true);

    const state = Object.assign(
      {},
      buildState(currentLocation.value,to,null),
      {position:currentState.position + 1},
      data,
    )
    changeLocation(to,state,false);
    currentLocation.value = to;
  }
  function replace(to,data){
    const state = Object.assign(
      {},
      buildState(historyState.value.back,to,historyState.value.forward,true),
      data
    )
    changeLocation(to,state,true);
    currentLocation.value = to;//更新当前路由路径
  }

  return {
    location:currentLocation,
    state:historyState,
    push,
    replace,
  }
}

/** 监听浏览器前进后退按钮
 *  将 history.state 状态同步到 historyState
 */
function useHistoryListeners(base,historyState,currentLocation){
  const listeners = [];
  // 会在跳转之后才执行回调
  const popStateHandler = ({state})=>{
    const to = createCurrentLocation(base);//去哪
    const from = currentLocation.value;//从哪来
    const fromState = historyState.value;//从哪来的状态

    //更新状态
    currentLocation.value = to;
    historyState.value = state;

    let isBack = state.position - fromState.position < 0

    listeners.forEach(cb => {
      cb(to,from,{isBack})
    })
  }

  window.addEventListener("popstate",popStateHandler);//只能监听浏览器的前进和后退

  const listen = (cb)=>{
    listeners.push(cb);
  }

  return {
    listen
  }
}

export function createWebHistory(base = ""){
  //路由系统最基本的要包含当前路径，当亲啊路径下的状态是什么（数据），需要提供两个切换路径的方法 push、repalce
  const historyNavigation = useHistoryStateNavigation(base);
  const historyListener = useHistoryListeners(base,historyNavigation.state,historyNavigation.location);

  // 为了方便用户访问，将两个对象合并成一个，并且进行代理，因为不代理取值的时候需要 .value
  const routerHistory = Object.assign({},historyNavigation,historyListener);
  
  Object.defineProperty(routerHistory,'location',{
    get(){
      return historyNavigation.location.value;
    }
  })
  Object.defineProperty(routerHistory,'state',{
    get(){
      return historyNavigation.state.value;
    }
  })

  return routerHistory
}