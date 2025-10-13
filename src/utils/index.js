import { Screens } from "../screens";

export const NavList = [
  {
    name: "Home",
    link: "/",
    component: <Screens.Main />
  }, 
  {
    name: "Admin",
    link: "/admin",
    component: <Screens.Admin />
  }, 
  {
    name: "Profile",
    link: "/profile",
    component: <Screens.Profile />
  }, 
  {
    name: "Login",
    link: "/login",
    component: <Screens.Login />
  }
]