function hxlProxyToJSON(input){
    var output = [];
    var keys = [];
    input.forEach(function(e,i){
        if(i==0){
            e.forEach(function(e2,i2){
                var parts = e2.split('+');
                var key = parts[0]
                if(parts.length>1){
                    var atts = parts.splice(1,parts.length);
                    atts.sort();                    
                    atts.forEach(function(att){
                        key +='+'+att
                    });
                }
                keys.push(key);
            });
        } else {
            var row = {};
            e.forEach(function(e2,i2){
                row[keys[i2]] = e2;
            });
            output.push(row);
        }
    });
    return output;
}

function print_filter(filter) {
    var f = eval(filter);
    if (typeof (f.length) != "undefined") {} else {}
    if (typeof (f.top) != "undefined") {
        f = f.top(Infinity);
    } else {}
    if (typeof (f.dimension) != "undefined") {
        f = f.dimension(function (d) {
            return "";
        }).top(Infinity);
    } else {}
    console.log(filter + "(" + f.length + ") = " + JSON.stringify(f).replace("[", "[\n\t").replace(/}\,/g, "},\n\t").replace("]", "\n]"));
}

var mapColor = '#D32F2F';
var barColor = '#CC6869';//'#096DB4';
var blue = '#096DB4';
var blueLight = '#72B0E0';
var green = '#06C0B4';
var mapColors =[mapColor,'#6FA3EA','#DDDDDD'];
var formatComma = d3.format(',');

function updateDescription (data) {
    $('.description p').text(data[0]['#meta+description'])
    $('.date_update h2 span').text("(as of "+data[0]['#date']+" )");
} //end of updateDescription


function checkIntData(d){
    return (isNaN(parseInt(d)) || parseInt(d)<0) ? 0 : parseInt(d);
}
var formatComma = d3.format(',');

function generateCharts (data, geom, reachedData) {

    data.forEach(function(d){
        d['#affected'] = checkIntData(d['#affected']);
        d['#affected+displaced'] = checkIntData(d['#affected+displaced']);
        d['#population'] = checkIntData(d['#population']);
    });
    reachedData.forEach(function(d){
        d['#reached'] = checkIntData(d['#reached']);
    });
    var lookup = genLookup(geom);

    var cf = crossfilter(data);
    var reached = crossfilter(reachedData);

    var dimTable = reached.dimension(function(d){ 
        return d['#reached']; 
    });
    var gpTable = dimTable.groupAll();
    // .reduceSum(function(d){
    //     return d['#reached'];
    // });
    // console.log(reachedData)

    var stateChart = dc.barChart('#stateChart');
    var regionChart = dc.rowChart('#regionChart');
    var whereChart = dc.leafletChoroplethChart('#map');
    var displayTotalAffected = dc.numberDisplay('#peopleAffected') ;
    var displayTotalDisplaced = dc.numberDisplay('#peopleDisplaced') ;
    // var dataTable = dc.dataTable('#table');


    var dimState = cf.dimension(function(d){
        return d['#region+name'];
    });
    var dimRegion = cf.dimension(function(d){
        return d['#adm1+name'];
    });
    var dimMap = cf.dimension(function(d){
        return d['#adm2+code'];
    });
    // var dimNumberDisplay = cf.dimension();

    var groupState = dimState.group().reduceSum(function(d){
        return d['#affected'];
    });
    var groupRegion = dimRegion.group().reduceSum(function(d){
        return d['#affected'];
    });
    var groupMap = dimMap.group().reduceSum(function(d){
        return d['#affected'];
    });
    var groupALL = cf.groupAll().reduce(
        function(p,v){
            p.totalAffected += +v['#affected'];
            p.totalDisplaced += +v['#affected+displaced'];

            return p;
        },
        function(p,v){
            p.totalAffected -= +v['#affected'];
            p.totalDisplaced -= +v['#affected+displaced'];

            return p;
        },
        function(){
            return {totalAffected: 0,
                    totalDisplaced: 0};
        }
    );

    stateChart
        .width(600)
        .height(270)
        .dimension(dimState)
        .group(groupState)
        .colors(barColor)
        .gap(2)
        .elasticY(true)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .renderHorizontalGridLines(true)
//        .xAxis().ticks(0)
        .yAxis().tickFormat(d3.format('.3s'));

    regionChart
        .width(600)
        .height(330)
        .dimension(dimRegion)
        .group(groupRegion)
        .data(function(group){
            return group.top(Infinity);
        })
        .colors(barColor)
        .elasticX(true)
//        .title(function(d){
//            return d.value;
//        })
//        .renderTitle(true)
        .xAxis().ticks(5);

    whereChart
        .width($('#map').width())
        .height(600)
        .dimension(dimMap)
        .group(groupMap)
        .center([5, 47]) //4.943/47.166
        .zoom(0)
        .geojson(geom)
        .colors(mapColors)
        .colorDomain([0, 3])
        .colorAccessor(function (d) {
            var c = 2;
            if (d > 1000) {
                c = 0;
            } else if (d > 0) {
                c = 1;
            };
            return c;
        })
        .featureKeyAccessor(function (feature) {
            return feature.properties['DIS_CODE'];
        }).popup(function (feature) {
            var text = lookup[feature.key] +'<br>'+formatComma(feature.value)+' People affected';
            return text;
        })
        .renderPopup(true);

    dc.dataTable('#data-table')
        .dimension(dimTable)
        .group(function(d){
            return 0;
        })
        .ordering(function(d){ return -d.value;})
        .size(20)
        .columns([
            function(d){ return d['#region+name'] },
            function(d){ return d['#sector+name']},
            function(d){ return formatComma(d['#reached']) }
        ])
        .sortBy(function(d){
            return d['#region+name'];
        });

        var totalAffectedAccessor = function(d) { return d.totalAffected ;} ;
        var totalDisplacedAccessor = function(d) { return d.totalDisplaced ;} ;

    displayTotalAffected
        .group(groupALL)
        .valueAccessor(totalAffectedAccessor);
    displayTotalDisplaced
        .group(groupALL)
        .valueAccessor(totalDisplacedAccessor);

    var rowtip = d3.tip().attr('class', 'd3-tip').html(function (d) {
        return d.key + ': ' + d3.format('0,000')(d.value);
    });
    var bartip = d3.tip().attr('class', 'd3-tip').html(function (d) {
        return d.data.key + ': ' + d3.format('0,000')(d.y);
    });
    
    dc.renderAll();
    
    d3.selectAll('g.row').call(rowtip);
    d3.selectAll('g.row').on('mouseover', rowtip.show).on('mouseout', rowtip.hide);
    
    d3.selectAll('.bar').call(bartip);
    d3.selectAll('.bar').on('mouseover', bartip.show).on('mouseout', bartip.hide);
    
    var map = whereChart.map();
    zoomToGeom(geom);
//    map.options.minZoom = 6;
//    map.options.maxZoom = 8;
    function zoomToGeom(geom) { // westlimit=40.99; southlimit=-1.8; eastlimit=51.62; northlimit=12.19
        var bounds = d3.geo.bounds(geom);
        var bnds = [
                    [8, 50.1],
                    [1.5, 43] 
                    ];
        // map.fitBounds([
        //     [bounds[0][1], bounds[0][0]],bbox=38.34228515625001%2C1.2413579498795726%2C52.53662109375001%2C10.671404468527449
        //     [bounds[1][1], bounds[1][0]] <iframe width="425" height="350" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://www.openstreetmap.org/export/embed.html?bbox=38.34228515625001%2C1.2413579498795726%2C52.53662109375001%2C10.671404468527449&amp;layer=mapnik" style="border: 1px solid black"></iframe><br/><small><a href="https://www.openstreetmap.org/#map=7/5.977/45.439">View Larger Map</a></small>
        // ]);
        map.fitBounds(bnds);
    }
    function genLookup(geojson) {
        var lookup = {};
        geojson.features.forEach(function (e) {
            lookup[e.properties['DIS_CODE']] = String(e.properties['DIST_NAME']);
        });
        return lookup;
    }

} //end of generateCharts

var descriptionCall = $.ajax({ 
    type: 'GET', 
    url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1dOpt2bZpuUIhrMye7s3Raad6NVyBG_Hn3iENI3Ci96w%2Fedit%23gid%3D1886492705&force=on',
    dataType: 'json',
});

var dataCall = $.ajax({ 
    type: 'GET', 
    url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1dOpt2bZpuUIhrMye7s3Raad6NVyBG_Hn3iENI3Ci96w%2Fedit%23gid%3D0&force=on',
    dataType: 'json',
});

var reachedDataCall = $.ajax({ 
    type: 'GET', 
    url: 'https://proxy.hxlstandard.org/data.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F1dOpt2bZpuUIhrMye7s3Raad6NVyBG_Hn3iENI3Ci96w%2Fedit%23gid%3D6760685&force=on',
    dataType: 'json',
});

var geomCall = $.ajax({
    type: 'GET',
    url: 'data/Somalia_District_Polygon.json',
    dataType: 'json',
});

$.when(descriptionCall, dataCall, geomCall, reachedDataCall).then(function(descArgs, dataArgs, geomArgs, reachedArgs){
    var reached = hxlProxyToJSON(reachedArgs[0]);
    var geom = geomArgs[0];
    var desc = hxlProxyToJSON(descArgs[0]);
    var data = hxlProxyToJSON(dataArgs[0])
    updateDescription(desc);
    // generateDataTable(reached);
    generateCharts(data, geom,reached);
});