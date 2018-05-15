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

var mapColor = '#2965AA';//'#D32F2F';
var barColor = '#2965AA';//'#CC6869';//'#096DB4';
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

function generateCharts (data, geom) {

    data.forEach(function(d){
        d['#affected'] = checkIntData(d['#affected']);
        d['#affected+displaced'] = checkIntData(d['#affected+displaced']);
        d['#population'] = checkIntData(d['#population']);
    });
    // reachedData.forEach(function(d){
    //     d['#reached'] = checkIntData(d['#reached']);
    // });
    var lookup = genLookup(geom);

    var cf = crossfilter(data);
    // var reached = crossfilter(reachedData);

    // var dimTable = reached.dimension(function(d){ 
    //     return d['#reached']; 
    // });
    // var gpTable = dimTable.groupAll();

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

    // dc.dataTable('#data-table')
    //     .dimension(dimTable)
    //     .group(function(d){
    //         return 0;
    //     })
    //     .ordering(function(d){ return -d.value;})
    //     .size(20)
    //     .columns([
    //         function(d){ return d['#region+name'] },
    //         function(d){ return d['#sector+name']},
    //         function(d){ return formatComma(d['#reached']) }
    //     ])
    //     .sortBy(function(d){
    //         return d['#region+name'];
    //     });

        var totalAffectedAccessor = function(d) { return d.totalAffected ;} ;
        var totalDisplacedAccessor = function(d) { return d.totalDisplaced ;} ;

    displayTotalAffected
        .formatNumber(formatComma)
        .group(groupALL)
        .valueAccessor(totalAffectedAccessor);
    displayTotalDisplaced
        .formatNumber(formatComma)
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

var sortData = function (d1, d2) {
    if (d1.key > d2.key) return 1;
    if (d1.key < d2.key) return -1;
    return 0;
};

function generateResponseCharts (data) {
    var cf = crossfilter(data) ;
    var dim = cf.dimension(function(d){ return [d['#sector+name'], d['#region+name']]; });
    // var dimCluster = cf.dimension(function(d){ return d['#sector+name']; });

    var grp = dim.group().reduceSum(function(d){ return d['#reached']; }).top(Infinity).sort(sortData);
    // var grpCluster = dimCluster.group().top(Infinity).sort(sortData);;

    var foodSecurityArr = [],
        healthArr = [],
        nutritionArr = [],
        shelterArr = [],
        washArr = [],
        educationArr = [],
        cccmArr = [];

    for (var i = 0; i < grp.length; i++) {
        grp[i].key[0]== 'Food Security'? foodSecurityArr.push([grp[i].key[1],grp[i].value]) :
        grp[i].key[0]== 'Health'? healthArr.push([grp[i].key[1],grp[i].value]) :
        grp[i].key[0]== 'Nutrition'? nutritionArr.push([grp[i].key[1],grp[i].value]) :
        grp[i].key[0]== 'Shelter'? shelterArr.push([grp[i].key[1],grp[i].value]) :
        grp[i].key[0]== 'WASH'? washArr.push([grp[i].key[1],grp[i].value]) :
        grp[i].key[0]== 'Education'? educationArr.push([grp[i].key[1],grp[i].value]) :
        grp[i].key[0]== 'CCCM'? cccmArr.push([grp[i].key[1],grp[i].value]) : '';

    }
    // var keyArr =[]; 
    // for (var i = 0; i < grpCluster.length; i++) {
    //     keyArr.push(grpCluster[i].key);
    // }

    var mapping = {};
    mapping['foodSecurity'] = {'data': foodSecurityArr, 'title': "Food Security"};
    mapping['health'] = {'data': healthArr, 'title': "Health"};
    mapping['nutrition'] = {'data': nutritionArr, 'title': "Nutrition"};
    mapping['shelter'] = {'data': shelterArr, 'title': "Shelter"};
    mapping['wash'] = {'data': shelterArr, 'title': "WASH"};
    mapping['education'] = {'data': educationArr, 'title': "Education"};
    mapping['cccm'] = {'data': cccmArr, 'title': "CCCM"};

    $('#clusterCharts').html(' ');

    for (k in mapping ){
        $('#clusterCharts').append('<div class="col-md-4"><h4><img class="img-responsive col-xs-2" src="img/'+k+'.svg">'+mapping[k].title+'</h4><div id="'+k+'"></div></div>');
        c3.generate({
            bindto: '#'+k+'',
            data: {
                columns: mapping[k].data,
                type: 'bar'
            },
            axis: {
                y: {
//                    label: 'Number of people assisted',
                    show: true,
                    tick: {
//                        count:10,
                        format: formatComma,
                    }
                },
                x: {
                    show: false
                }
            },
            size: {
                height: 300
            },
            color:{
                pattern:['#3F75B0','#D7DCE3','#DFEBF6','#AEB9C8','#A2C2E3','#6FA3EA']//["#fef0d9","#fdcc8a","#fc8d59","#e34a33","#D32F2F"] //["#edf8e9","#bae4b3","#74c476","#31a354","#006d2c"]
            },
            bar: {
                width: {
                    ratio: 0.95
                }
            }
        });
    }

} //end of generateResponseCharts


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
    generateCharts(data, geom);
    generateResponseCharts(reached);

});