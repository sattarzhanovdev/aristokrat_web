import { useLocation } from "react-router-dom";
import { NavList } from "../utils";

export const MainRoutes = () => {
  const path = useLocation().pathname;
  
  return (
    <>
      {
        NavList.map((item, index) => (
          item.link === path ? <div key={index}>{item.component}</div> : null
        ))
      }
    </>
  )
}