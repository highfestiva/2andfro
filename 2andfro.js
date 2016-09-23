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
          refCounts[refIdx] = refs[refIdx];
        }
      }
    }
  }
  for (var refIdx in refCounts) {
    var refCnt = refCounts[refIdx];
    heatmapData.push({location: b[refIdx], weight: refCnt});
  }

  setLegendLabels();
}

function userPickArea(map, heatmap) {
  var button = 1;
  google.maps.event.addDomListener(document.getElementById("map"), 'mousedown', function(e) {
      button = +!e.ctrlKey;
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

function setGradient() {
  gradient = [
    'rgba(0, 255, 255, 0)',
    'rgba(0, 255, 255, 1)',
    'rgba(0, 191, 255, 1)',
    'rgba(0, 127, 255, 1)',
    'rgba(0, 63, 255, 1)',
    'rgba(0, 0, 255, 1)',
    'rgba(0, 0, 223, 1)',
    'rgba(0, 0, 191, 1)',
    'rgba(0, 0, 159, 1)',
    'rgba(0, 0, 127, 1)',
    'rgba(63, 0, 91, 1)',
    'rgba(127, 0, 63, 1)',
    'rgba(191, 0, 31, 1)',
    'rgba(255, 0, 0, 1)'
  ]
  heatmap.set('gradient', gradient);
}

function setLegendGradient() {
    var gradientCss = '(left';
    for (var i = 0; i < gradient.length; ++i) {
        gradientCss += ', ' + gradient[i];
    }
    gradientCss += ')';

    $('#legendGradient').css('background', '-webkit-linear-gradient' + gradientCss);
    $('#legendGradient').css('background', '-moz-linear-gradient' + gradientCss);
    $('#legendGradient').css('background', '-o-linear-gradient' + gradientCss);
    $('#legendGradient').css('background', 'linear-gradient' + gradientCss);
}

function setLegendLabels() {
    console.log('here')
    var maxIntensity = heatmap['gm_bindings_']['maxIntensity'][117]['Mc']['b'];
    var legendWidth = $('#legendGradient').outerWidth();

    var slice = maxIntensity / 5;

    $('#legend :not(#legendGradient)').remove();

    for (var i = 0; i <= maxIntensity; i += slice) {
        console.log(i)
        var offset = i * legendWidth / maxIntensity;
        if (i > 0 && i < maxIntensity) {
            offset -= 0.5;
        } else if (i == maxIntensity) {
            offset -= 1;
        }

        $('#legend').append($('<div>').css({
            'position': 'absolute',
            'left': offset + 'px',
            'top': '30%',
            'width': '1px',
            'height': '3px',
            'background': 'black'
        }));
        $('#legend').append($('<div>').css({
            'position': 'absolute',
            'left': (offset - 5) + 'px',
            'top': '35%',
            'width': '10px',
            'text-align': 'center',
            'font-size': '0.8em',
        }).html(i.toFixed(1)));

    }
}


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
  setGradient();
  setLegendGradient();
  function parse(data, arr) {
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
