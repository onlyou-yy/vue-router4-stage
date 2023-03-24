import { computed, h, inject, provide } from "vue"

export const RouterView = {
  name:"RouterView",
  setup(props,{slots}){//只会执行一次
    //先渲染父在渲染子,matched = [parent,child]
    const depth = inject("depth",0);
    const injectRoute = inject("route location");
    const matchedRouteRef = computed(()=>injectRoute.matched[depth])

    provide("depth",depth + 1);

    return ()=>{
      // 我们需要每次切换的时候都拿到最新值
      const matchRoute = matchedRouteRef.value;
      const viewComponent = matchRoute && matchRoute.components.default;

      if(!viewComponent){
        return slots.default && slots.default();
      }
      
      return h(viewComponent)
    }
  }
}