var G = { };
// https://github.com/MasterMaps/d3-slider
function onAgeMinChange(evt, value) {
  d3.select('#text-age-min').text(value);
  var n = +value + Number(d3.select('#text-age-span').text()) - 1;
  d3.select('#text-age-max').text(n);
  refreshPopMap();
}
function onAgeSpanChange(evt, value) {
  d3.select('#text-age-span').text(value);
  var n = +d3.select('#text-age-min').text() + value - 1;
  d3.select('#text-age-max').text(n);
  refreshPopMap();
}
function popRatio(d) {
  var minAge = +d3.select('#text-age-min').text();
  var ageSpan = +d3.select('#text-age-span').text();
  var upper = minAge + ageSpan;
  if (upper > 101) {
    upper = 101;
  }
  return (d['男'][upper] + d['女'][upper] -
      d['男'][minAge] - d['女'][minAge]) /
    (d['男'][101] + d['女'][101]);
}
function maleBinomialZ(d) {
  var minAge = +d3.select('#text-age-min').text();
  var ageSpan = +d3.select('#text-age-span').text();
  var upper = minAge + ageSpan;
  if (upper > 101) {
    upper = 101;
  }
  var m = d['男'][upper] - d['男'][minAge];
  var f = d['女'][upper] - d['女'][minAge];
  return (m - f) / Math.sqrt(m + f + 0.01);
}
function refreshPopMap() {
  var canvas = d3.select('#pm-canvas'),
    towns = canvas.selectAll('path.town'),
    prmin = d3.min(G.targetCensusData, popRatio),
    prmax = d3.max(G.targetCensusData, popRatio);
  var ratio2color = d3.scale.linear()
    .range(['blue', 'white', 'red'])
    .interpolate(d3.interpolateLab)
    .domain([prmin, (prmin+prmax)/2, prmax]);
  towns.transition()
    .attr('fill', function(d) {
      return ratio2color(popRatio(d));
    });
  ratio2color.domain(ratio2color.domain().map(function(r) { return r*100; }));
  G.legendPainter.scale(ratio2color);
  G.legendPainter(d3.select('#color-legend'));
}
function createAxes() {
  var sx = d3.scale.linear().domain([0, 1]).range([0, 800]),
    sy = d3.scale.linear().domain([-3, 3]).range([0, 600]),
    canvas = d3.select('#gp-canvas');
  canvas.append('g').attr('id', 'x_axis');
  canvas.append('g').attr('id', 'y_axis');
}
function rebuildLegend() {
  d3.select('#color-legend').remove();
  var legendBox = d3.select('#pm-zoom-or-zoomless')
    .append('g')
    .attr('id', 'color-legend')
    .attr('transform', 'translate(20,20)');
  G.legendPainter = d3.legend.color()
    .cells(7)
    .title('圖例(%)')
    .ascending(true);
}
function prepareTargetRegion(selected) {
  if (typeof selected == 'undefined') {
    var rs = d3.select('#region-selection').node();
    selected = rs.options[rs.selectedIndex].value;
  }
  G.targetCity = selected;
  G.targetCensusData = G.fullCensusData.filter(function(d) {
    return d.name.indexOf(G.targetCity) >= 0;
  });
  /******************* population map *******************/
  var viewBox = d3.select('#pm-rsvg-wrapper').map(parseFloat);
  var width = viewBox[2], height = viewBox[3];
  var mproj = d3.geo.mercator().scale(1).translate([0, 0]);
  var mapObjs = d3.geo.path().projection(mproj);
  var targetBoundary = {
    'type': 'FeatureCollection'
  };
  targetBoundary.features = G.countyBoundary.features.filter(function(d) {
    return d.properties['C_Name'].indexOf(G.targetCity) >= 0;
  });
  var b = mapObjs.bounds(targetBoundary),
    s = 0.95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height),
    t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];
  mproj.scale(s).translate(t);
  var counties = d3.select('#pm-canvas').selectAll('path.county');
  counties.remove();
  counties = d3.select('#pm-canvas').selectAll('path.county')
    .data(G.countyBoundary.features, function(d) {
      return d.properties['C_Name'];
    });
  counties.enter()
    .append('path')
    .attr('d', mapObjs)
    .attr('class', 'county')
    .attr('fill', '#ffe')
    .attr('stroke', 'black')
    .attr('stroke-width', 0.5)
    .append('svg:title')
    .text(function(d) {
      return d.properties['C_Name'];
    });
  towns = d3.select('#pm-canvas').selectAll('path.town')
    .data(G.targetCensusData, function(d) {
      return d.name;
    });
  towns.exit().remove();
  towns.enter()
    .append('path')
    .attr('d', function(d) {
      return mapObjs(d.boundary);
    })
    .attr('class', 'town')
    .append('svg:title')
    .text(function(d) {
      return d.name;
    });
  refreshPopMap();
}

function init(error, data) {
  /******************* received input data files *******************/
  if (error) { return console.warn(error); }

  G.fullCensusData = data[0];
  G.townBoundary = data[1];
  G.countyBoundary = data[2];

  var n2map = {};
  G.townBoundary.features.forEach(function(d) {
    n2map[d.properties.name] = d;
  });

  var regionList = {};
  G.fullCensusData.forEach(function(d) {
    regionList[/^(.{2,3}(縣|市))/.exec(d.name)[1]] = 0;
    if (d.name in n2map) {
      d.boundary = n2map[d.name];
    } else {
      console.log(d.name + ' of census-town.json not found in town-boundary.json');
    }
  });

  G.fullCensusData.forEach(function(d) {
    d['男'].unshift(0);
    d['女'].unshift(0);
  });

  /******************* slider *******************/
  var v = d3.select('#text-age-min').text();
  d3.select('#slider-age-min').call(
    d3.slider().axis(true).min(0).max(100)
      .step(1).value(v).on('slide', onAgeMinChange)
  );
  v = d3.select('#text-age-span').text();
  d3.select('#slider-age-span').call(
    d3.slider().axis(true).min(1).max(101)
      .step(1).value(v).on('slide', onAgeSpanChange)
  );

  /******************* city/county selection *******************/
  var regionSelection = d3
    .select('#region-selection')
    .selectAll('option')
    .data(Object.keys(regionList))
    .enter()
    .append('option')
    .attr('class', 'bc-entry')
    .html(function(d) {
      return d;
    });
  d3.select('#region-selection').on('change', prepareTargetRegion);
  // https://stackoverflow.com/questions/18883675/d3-js-get-value-of-selected-option

  /******************* gender plot *******************/
  // gender plot zoom
  var gpzoom = d3.behavior.zoom()
    .scaleExtent([0.2, 8])
    .on('zoom', function () {
      d3.select('#gp-canvas').attr('transform', 'translate(' +
        d3.event.translate + ')scale(' + d3.event.scale + ')');
    });

  // http://bl.ocks.org/cpdean/7a71e687dd5a80f6fd57
  // https://stackoverflow.com/questions/16265123/resize-svg-when-window-is-resized-in-d3-js
  d3.select('#gp-rsvg-wrapper')
    .append('svg')
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .attr('viewBox', '0 0 800 600')
    .attr('class', 'rsvg-content')
    .call(gpzoom)
    .append('g')
    .attr('id', 'gp-canvas');
  createAxes();

  /******************* population map *******************/
  // population map zoom
  var pmzoom = d3.behavior.zoom()
    .scaleExtent([0.1, 30])
    .on('zoom', function() {
      d3.select('#pm-canvas').attr('transform', 'translate(' +
        d3.event.translate + ')scale(' + d3.event.scale + ')');
    });

  d3.select('#pm-rsvg-wrapper')
    .append('svg')
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .attr('viewBox', '0 0 800 600')
    .attr('class', 'rsvg-content')
    .call(pmzoom)
    .append('g')
    .attr('id', 'pm-zoom-or-zoomless')	// see legend
    .append('g')
    .attr('id', 'pm-canvas');

  /**************** start default target city/county ****************/
  var defaultTarget = '臺中市';
  d3.select('#region-selection').property('value', defaultTarget);
  prepareTargetRegion(defaultTarget);
}

// https://github.com/mbostock/queue
queue()
  .defer(d3.json, 'census-town.json')
  .defer(d3.json, 'town-boundary.json')
  .defer(d3.json, 'county-boundary.json')
  .awaitAll(init);

// https://stackoverflow.com/questions/13808741/bar-chart-with-d3-js-and-an-associative-array
// Bar chart with d3.js and an associative array
//    var divs = barChart.selectAll('.entry').data(
//        d3.entries(G.targetCensusData), function(d) { return d.key; }
//    );
//	    match = /^(.*?(縣|市))(.*)$/.exec(d.name);
