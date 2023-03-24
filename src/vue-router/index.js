import { computed, shallowRef, unref,reactive } from "vue";
import { RouterLink } from "./router-link";
import { RouterView } from "./router-view";

import {createWebHashHistory} from "./history/hash";
import {createWebHistory} from "./history/html5";
import { createRouterMatcher } from "./matcher";

function useCallback(){
  const handlers = []
  function add(handler){
    handlers.push(handler);
  }
  return {
    add,
    list:()=>handlers
  }
}

function extractChangeRecords(to,from){
  const leavingRecords = [];
  const updatingRecords  = [];
  const enteringRecords = [];
  const len = Math.max(to.matched.length,from.matched.length);

  for(let i = 0;i < len;i++){
    const recordFrom = from.matched[i]
    if(recordFrom){
      if(to.matched.find(record => record.path === recordFrom.path)){
        // 去和来一样，更新
        updatingRecords.push(recordFrom);
      }else{
        // 不一样就是 离开
        leavingRecords.push(recordFrom);
      }
    }

    const recordTo = to.matched[i]
    if(recordTo){
      if(!from.matched.find(record => record.path === recordTo.path)){
        // 去的有，来的没有，进入
        enteringRecords.push(recordTo);
      }
    }
  }

  return [
    leavingRecords,
    updatingRecords,
    enteringRecords,
  ]
}

function guardToPromise(guard,to,from,record){
  return ()=>new Promise((resolve,reject)=>{
    const next = ()=>resolve();
    const guardReturn = guard.call(record,to,from,next);
    //如果没有调用next就帮他调用
    return Promise.resolve(guardReturn).then(next);
  })
}

function extractComponentsGuards(matched,guardType,to,from){
  const guards = [];
  for(const record of matched){
    const rawComponent = record.components.default;
    const guard = rawComponent[guardType];
    // 将所有的路由守卫串联在一起
    guard && guards.push(guardToPromise(guard,to,from,record))
  }
  return guards;
}

//组合守卫调用链
function runGuardQueue(guards){
  return guards.reduce((promise,guard)=>{
    return promise.then(()=>guard());
  },Promise.resolve())
}

// 初始化系统的默认参数
const START_LOCATION_NORMALIZED = {
  path:'/',
  matched:[],
}

function createRouter(options){
  const routerHistory = options.history;
  //为了方便之后通过路径来匹配组件所以先将路由配置格式化
  // /home => record{ home }
  // /a => record{A,parent:home}
  // 渲染的时候要先渲染父组件然后再渲染子组件
  const matcher = createRouterMatcher(options.routes);

  // 当前路由状态数据，为啥不用 ref 或者 reactive ？因为要解决结构出来的数据失去响应性
  const currentRoute = shallowRef(START_LOCATION_NORMALIZED);
  // 为了解决结构出来的数据丢失响应性，再给每个属性用计算属性包裹
  const reactiveRoute = {};
  for(let key in START_LOCATION_NORMALIZED){
    reactiveRoute[key] = computed(()=>currentRoute.value[key])
  }
  // 如果之后不想通过 currentRoute.value 来访问数据可以再用 obj= reactive(currentRoute) 包裹一下

  const beforeGuards = useCallback()
  const afterGuards = useCallback();
  const beforeResolveGuards = useCallback();

  function resolve(to){ // 可以是 to="/" :to={path:"/"}
    if(typeof to === "string"){
      return matcher.resolve({path:to});
    }
  }

  let ready = false
  function markAsReady(){
    if(ready) return;
    ready = true;
    routerHistory.listen(to =>{
      const targetLocation = resolve(to);
      const fromRoute = currentRoute.value;
      //popStateHandler 做的是更新history中历史栈中的状态
      //但是我们自己维护的状态 currentRoute 的状态并没有更新，所以要使用替换模式更新currentRoute的状态为最新的状态
      //在前进后退是替换模式，不是 push 模式
      finalizeNavigation(targetLocation,fromRoute,false)
    })
  }

  function finalizeNavigation(to,from,replaced){
    if(from === START_LOCATION_NORMALIZED || replaced){
      routerHistory.replace(to.path);
    }else{
      routerHistory.push(to.path);
    }
    //同步状态
    currentRoute.value = to;

    // 添加监听器，监听浏览器前进后退按钮，并更新状态
    markAsReady();

    console.log(currentRoute.value,routerHistory.state);
  }

  async function navigate(to,from){
    //需要知道是从 哪 到 哪的，谁更新
    const [leavingRecords,updatingRecords,enteringRecords] = extractChangeRecords(to,from);

    //抽离组件守卫钩子
    let guards = extractComponentsGuards(
      leavingRecords.reverse(),
      "beforeRouteLeave",
      to,
      from,  
    );
    
    return runGuardQueue(guards).then(()=>{
      guards = [];
      for(const guard of beforeGuards.list()){
        guards.push(guardToPromise(guard,to,from,guard))
      }
      return runGuardQueue(guards);
    }).then(()=>{
      guards = extractComponentsGuards(
        updatingRecords,
        "beforeRouteUpdate",
        to,
        from,  
      );
      return runGuardQueue(guards);
    }).then(()=>{
      guards = [];
      for(const record of to.matched){
        if(record.beforeEnter){
          guards.push(guardToPromise(record.beforeEnter,to,from,record))
        }
      }
      return runGuardQueue(guards);
    }).then(()=>{
      guards = extractComponentsGuards(
        enteringRecords,
        "beforeRouteEnter",
        to,
        from,  
      );
      return runGuardQueue(guards);
    }).then(()=>{
      guards = [];
      for(const guard of beforeResolveGuards.list()){
        guards.push(guardToPromise(guard,to,from,guard))
      }
      return runGuardQueue(guards);
    })
  }

  //通过路径匹配到对应的记录，更新currentRoute
  function pushWithRedirect(to){
    const targetLocation = resolve(to);
    const from = currentRoute.value

    //路由守卫处理
    navigate(targetLocation,from).then(()=>{
      //根据是不是第一次来决定是 push 还是 replace
      finalizeNavigation(targetLocation,from)
    }).then(()=>{
      // 导航结束，调用 afterEach
      for(const guard of afterGuards.list()) guard(to,from);
    })
  }

  function push(to,data){
    return pushWithRedirect(to)
  }

  const router = {
    push,
    beforeEach:beforeGuards.add,
    afterEach:afterGuards.add,
    beforeResolve:beforeResolveGuards.add,
    install(app){ //路由的核心就是监听路由变化更新页面
      const router = this;
      app.config.globalProperties.$router = router;
      Object.defineProperty(app.config.globalProperties,"$route",{
        enumerable:true,
        get:()=>unref(currentRoute)
      })
      // 注入 路由数据，useRouter() => inject("router")
      app.provide("router",router);
      app.provide("route location",reactive(reactiveRoute));//reactive(currentRoute)包裹之后不需要 .value

      app.component("RouterLink",RouterLink)
      app.component("RouterView",RouterView)

      if(currentRoute.value === START_LOCATION_NORMALIZED){
        // 默认就是初始化，第一次进入的时候需要先做一次重定向调整，跳到指定的路由组件，并且收集数据
        push(routerHistory.location);
      }

    }
  }

  return router;
}

export {
  createWebHashHistory,
  createWebHistory,
  createRouter
}