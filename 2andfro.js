var aUrl = 'a.json';
var bUrl = 'b.json';
var A = [];
var B = [];
var src = A;
var dst = B;
var poly = null;
var heatmap = [];

function optimizePathDraw(path, newLatLng) {
  var len = path.getLength();
  if (len >= 2) {
    var oldLatDelta = path.getAt(len-1).lat() - path.getAt(len-2).lat();
    var oldLngDelta = path.getAt(len-1).lng() - path.getAt(len-2).lng();
    var oldDist = Math.sqrt(oldLatDelta*oldLatDelta + oldLngDelta*oldLngDelta);
    var newLatDelta = newLatLng.lat() - path.getAt(len-1).lat();
    var newLngDelta = newLatLng.lng() - path.getAt(len-1).lng();
    var newDist = Math.sqrt(newLatDelta*newLatDelta + newLngDelta*newLngDelta);
    var dotProd = oldLatDelta*newLatDelta + oldLngDelta*newLngDelta;
    if (dotProd > oldDist*newDist*0.9) {
      path.pop();
    }
  }
}

function optimizeCompletePath(path) {
  var len = path.getLength();
  var maxDistance2 = -1;
  for (i = 0; i < len-1; ++i) {
    var p1 = path.getAt(i);
    var p2 = path.getAt(i+1);
    var latDelta = p1.lat()-p2.lat();
    var lngDelta = p1.lng()-p2.lng();
    var distance2 = latDelta*latDelta + lngDelta*lngDelta;
    maxDistance2 = (distance2 > maxDistance2)? distance2 : maxDistance2;
  }
  for (i = 0; i < len-1; ++i) {
    var p1 = path.getAt(i);
    var p2 = path.getAt(i+1);
    var latDelta = p1.lat()-p2.lat();
    var lngDelta = p1.lng()-p2.lng();
    var distance2 = latDelta*latDelta + lngDelta*lngDelta;
    if (distance2*100 < maxDistance2) {
      path.removeAt(i+1);
      --i;
      --len;
    }
  }
}

function showTargets(poly, heatmap, a, b) {
  var heatmapData = heatmap.getData();
  heatmapData.clear();
  var refCounts = {};
  for (var i in a) {
    if (google.maps.geometry.poly.containsLocation(a[i], poly)) {
      var refs = a[i].references;
      for (var refIdx in refs) {
        if (refIdx in refCounts) {
          refCounts[refIdx] += refs[refIdx];
        } else {
          refCounts[refIdx] = 1;
        }
      }
    }
  }
  for (var refIdx in refCounts) {
    var refCnt = refCounts[refIdx]
    heatmapData.push({location: b[refIdx], weight: refCnt});
  }
}

function userPickArea(map, heatmap) {
  var button = 1;
  google.maps.event.addDomListener(document.getElementById("map"), 'mousedown', function(e) {
      button = e.button;
      return false;
    }, capture=true);
  var mouseMoveHandler = null;
  google.maps.event.addListener(map, 'mousedown', function(e) {
      if (button !== 0) {
        return false;
      }
      map.setOptions({draggable: false});
      if (poly != null) {
        poly.setMap(null);
      }
      console.log(e.latLng.lat(), e.latLng.lng());
      poly = new google.maps.Polygon(
          {           map: map,
                     path: [],
              strokeColor: "#00ffff",
            strokeOpacity: 0.8,
             strokeWeight: 2,
                clickable: false });
      mouseMoveHandler = google.maps.event.addListener(map, 'mousemove', function(e) {
          var path = poly.getPath();
          // Remove unnecessary points if mouse continues in same direction.
          optimizePathDraw(path, e.latLng);
          path.push(e.latLng);
        });
      return false;
    });
  google.maps.event.addListener(map, 'mouseup', function(e) {
      google.maps.event.removeListener(mouseMoveHandler);
      map.setOptions({draggable: true});
      if (poly != null) {
        // Optimize unnecessary (short) segments when shape completely drawn.
        optimizeCompletePath(poly.getPath());
        showTargets(poly, heatmap, src, dst);
      }
      return false;
    });
}

$(document).ready(function() {
    $('.switch-input').change(function() {
        if (this.value == 'a2b') {
          src = A;
          dst = B;
        } else if (this.value == 'b2a') {
          src = B;
          dst = A;
        }
        showTargets(poly, heatmap, src, dst);
    });
});

function initMap() {
  var map = new google.maps.Map(
      document.getElementById('map'),
      {       center: new google.maps.LatLng(mapLat, mapLng),
                zoom: mapZoom,
           mapTypeId: google.maps.MapTypeId.HYBRID,
        scaleControl: true,
           clickable: false,
      clickableIcons: false });
  heatmap = new google.maps.visualization.HeatmapLayer(
      { radius: heatmapRadius,
           map: map });
  function parse(data, arr) {
    data = JSON.parse(data);
    for (var i in data) {
      var chunk = new google.maps.LatLng(data[i][0],data[i][1]);
      chunk.references = data[i][2];
      arr.push(chunk);
    }
  }
  $.get(aUrl, function(data) { parse(data, A); });
  $.get(bUrl, function(data) { parse(data, B); });
  userPickArea(map, heatmap);
}
