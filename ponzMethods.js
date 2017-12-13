const ponzPointz = (ponzDist) => {
 let pointz = 40;
 for (let i=1; i<ponzDist; i++) {
   pointz = parseInt(pointz/2);
 }
 return pointz;
}

module.exports = {
  ponzPoints
}
