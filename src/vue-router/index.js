import { computed, shallowRef, unref,reactive } from "vue";
import { RouterLink } from "./router-link";
import { RouterView } from "./router-view";

import {createWebHashHistory} from "./history/hash";
import {createWebHistory} from "./history/html5";
import { createRouterMatcher } from "./matcher";


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

  //通过路径匹配到对应的记录，更新currentRoute
  function pushWithRedirect(to){
    const targetLocation = resolve(to);
    const from = currentRoute.value

    //根据是不是第一次来决定是 push 还是 replace
    finalizeNavigation(targetLocation,from)
  }

  function push(to,data){
    return pushWithRedirect(to)
  }

  const router = {
    push,
    beforeRouter,
    afterRouter,
    beforeResolve,
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