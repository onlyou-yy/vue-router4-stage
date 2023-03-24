//对路由数据进行结构化
function normalizeRouteRecord(record){
  return {
    path:record.path,
    meta:record.meta || {},
    beforeEnter:record.beforeEnter,
    name:record.name,
    components:{
      default:record.component
    },
    children:record.children || [],
  }
}

//创建父子关系结构
function createRouteRecordMatcher(record,parent){
  const matcher = {
    path:record.path,
    record,
    parent,
    children:[],
  }
  if(parent){
    parent.children.push(matcher);
  }
  return matcher;
}



export function createRouterMatcher(routes){
  const matchers = [];
  function addRoute(route,parent){
    let normalizeRecord = normalizeRouteRecord(route);
    if(parent){
      // 拼上父节点的路径
      normalizeRecord.path = parent.path + normalizeRecord.path;
    }
    const matcher = createRouteRecordMatcher(normalizeRecord,parent);
    if("children" in normalizeRecord){
      let children = normalizeRecord.children;
      for(let i = 0;i < children.length;i++){
        addRoute(children[i],matcher)
      }
    }
    matchers.push(matcher)
  }

  routes.forEach(route => addRoute(route));

  function resolve(location){
    const matched = [];
    const path = location.path;
    let matcher = matchers.find(f => f.path == path);
    while(matcher){
      matched.unshift(matcher.record);
      matcher = matcher.parent;
    }
    return {
      path,
      matched
    }
  }
  
  return {
    resolve,
    addRoute,
  }
}