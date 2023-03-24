<template>
  <div class="home">
    <h1>HomeView</h1>
    <router-link to="/a">A Page</router-link>
    <router-link to="/b">B Page</router-link> 
    <router-view></router-view>
  </div>
</template>

<script>

export default {
  name: 'HomeView',
  beforeRouteEnter(to,from,next){
    console.log("beforeRouteEnter",to)
  },
  beforeRouteUpdate(to,from,next){
    console.log("beforeRouteUpdate",to)
  },
  beforeRouteLeave(to,from,next){
    console.log("beforeRouteLeave",to)
  },
}

// 执行顺序
// a -> b
/**
 * a beforeRouteLeave
 * b beforeEach(全局)
 * b beforeEnter(路由)
 * b beforeRouteEnter（组件）
 * b beforeResolve(全局)
 * a afterEach(全局)
 */
</script>
