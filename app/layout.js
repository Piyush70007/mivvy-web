import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './globals.css';
export const metadata={title:'Mivvy — A little more human.',applicationName:'Mivvy',description:'Your personal AI space. Talk, plan, and make room for what matters.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'Mivvy'}};
export const viewport={width:'device-width',initialScale:1,themeColor:'#09090d',viewportFit:'cover'};
export default function Layout({children}){return <html lang="en"><body>{children}</body></html>}
