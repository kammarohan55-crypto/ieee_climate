import fs from 'node:fs';
const geo=JSON.parse(fs.readFileSync('public/land.geojson','utf8').replace(/^\uFEFF/,''));
const polygons=geo.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
const inside=(x,y,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const bounds=polygons.map(p=>({p,minx:Math.min(...p[0].map(c=>c[0])),maxx:Math.max(...p[0].map(c=>c[0])),miny:Math.min(...p[0].map(c=>c[1])),maxy:Math.max(...p[0].map(c=>c[1]))}));
const points=[];for(let y=-85;y<=85;y+=1.4){for(let x=-180;x<180;x+=1.4/Math.max(.3,Math.cos(y*Math.PI/180))){if(bounds.some(b=>x>=b.minx&&x<=b.maxx&&y>=b.miny&&y<=b.maxy&&inside(x,y,b.p[0])&&!b.p.slice(1).some(r=>inside(x,y,r))))points.push([+x.toFixed(3),+y.toFixed(3)]);}}
fs.writeFileSync('public/globe-land.json',JSON.stringify({points,rings:polygons.map(p=>p[0])}));console.log(`Prepared ${points.length} geographic land points from Natural Earth.`);
