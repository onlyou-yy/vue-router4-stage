import { createRouter, createWebHistory } from '@/vue-router'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    children:[
      {
        path:'a',
        component:{render:()=><h2>this is a page</h2>}
      },
      {
        path:'b',
        component:{render:()=><h2>this is b page</h2>}
      }
    ],
    beforeEnter(to,from,next){
      console.log("beforeEnter",to)
    }
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to,from,next)=>{
  console.log("beforeEach",to)
})
router.beforeResolve((to,from,next)=>{
  console.log("beforeResove",to)
})
router.afterEach((to,from,next)=>{
  console.log("beforeResove",to)
})

export default router
