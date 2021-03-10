var alleles = [
  'F_30_S',
  'S_35_N',
  'S_36_N',
  'I_57_S',
  'T_64_S',
  'A_65_T',
  'N_66_A',
  'T_79_S',
  'K_82_I',
  'S_83_F',
  'T_84_S',
  'S_85_N',
  'S_92_N',
  'R_95_T',
  'Y_103_F',
  'Y_113_S'];

var allele_divs = [];

var alleles_fixed = [];
var alleles_colored = [];
for (let i=0; i<alleles.length; i++) {
  alleles_fixed.push('either');
}

var color_wheel = ["#0173b2","#de8f05","#029e73","#d55e00","#cc78bc","#ca9161","#ece133","#56b4e9"];

var color_variants = {'0000000000000000': '#FF0000',
                      '1111111111111111': '#0000FF'};

var color_wheel_rgb = [];
for (let c of color_wheel) {
  color_wheel_rgb.push(d3.color(c));
}

var main_data;
var use_data;

var xs;
var ys;
var violin_y = d3.scaleLinear().domain([0,1]).range([100,600]);
var x_by_kd = d3.scaleLinear().domain([7,10]).range([630,790]);
var color_by_kd = d3.scaleSequential(d3.interpolateViridis).domain([7,10]);
var color_by_freq = d3.scaleSequential(d3.interpolateRgb("white", "red")).domain([0,1]);
var canvasWidth = 800;
var canvasHeight = 600;
var canvas;
var ctx;
var canvasData;
var colorMap = {};
var hoverMap = [];

var data_by_variant = {};

var kd_var = 'H1';
var kd_axis;

var violin_y_pos_counter = {}; //formatted like genotype: [y_baseline_position, dict from ypos to counter of pixels (for y displacement)]

var pixel_hover_range = 15 // 15 is minimum pixel for hover behavior

for (let i=0; i<canvasWidth; i++) {
  hoverMap.push([]);
  for (let j=0; j<canvasHeight; j++) {
    hoverMap[i].push({'variant': 'none', 'point_location': null, 'dist': pixel_hover_range}); 
  }
}

// DRAWING

// That's how you define the value of a pixel //
//https://stackoverflow.com/questions/7812514/drawing-a-dot-on-html5-canvas//
function drawPixel(x, y, r, g, b, a) {
  let index = (x + y * canvasWidth) * 4;

  canvasData.data[index + 0] = r;
  canvasData.data[index + 1] = g;
  canvasData.data[index + 2] = b;
  canvasData.data[index + 3] = a;
}

function clearImageData() {
  for (let i=0; i<canvasData.data.length; i++) {
    canvasData.data[i]=255;
  }
}

function draw_data() {
  clearImageData();
  for (let d of use_data) {
    let [x, y, r, g, b, a, kx, ky] = [d['x'], d['y'], d['r'], d['g'], d['b'], d['a'], d['kdx'], d['kdy']];
    drawPixel(kx, ky, r, g, b, a);
    for (let i=0; i<4; i++) {
      for (j=0; j<4; j++) {
        if (!(((i==0) || (i==3)) && ((j==0) || (j==3)))) {
          drawPixel(x-1+i, y-1+j, r, g, b, a);
        }
      }
    }
    //drawPixel(canvasData, x, y, r, g, b, 255);
    //drawPixel(canvasData, x-1, y, r, g, b, 255);
    //drawPixel(canvasData, x+1, y, r, g, b, 255);
    //drawPixel(canvasData, x, y-1, r, g, b, 255);
    //drawPixel(canvasData, x, y+1, r, g, b, 255);
  }
  ctx.putImageData(canvasData, 0, 0);
}

function draw_brush_only() {
  for (let d of use_data) {
    let [x, y, a, kx, ky] = [d['x'], d['y'], d['a'], d['kdx'], d['kdy']];
    let index = (kx + ky * canvasWidth) * 4;
    canvasData.data[index + 3] = a;
    for (let i=0; i<4; i++) {
      for (j=0; j<4; j++) {
        if (!(((i==0) || (i==3)) && ((j==0) || (j==3)))) {
          index = ((x-1+i) + (y-1+j) * canvasWidth) * 4;
          canvasData.data[index + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(canvasData, 0, 0);
}

function reset_violin_y() {
  violin_y_pos_counter = {}
  for (let d of use_data) {
    d['kdy'] = get_violin_y(d['kdx'], d);
  }
}

function color_data(first_time=false) {
  for (let d of main_data) {
    let geno_str = ''; // genotype string
    let ypos_counter = 0;
    let v = d['variant'];
    let tmp_color;
    if (alleles_colored.length==0) {
      tmp_color = d['kd_color'];
    } else {
      let color_index = 0;
      for (let i=0; i<alleles_colored.length; i++) {
        color_index += (2**i)*Number(v[alleles_colored[i]]);
        geno_str += d['variant'][alleles_colored[i]] + ' ';
        ypos_counter += (2**i)*Number(v[alleles_colored[i]]);
      }
      tmp_color = color_wheel_rgb[color_index];
    }
    colorMap[d['variant']] = tmp_color;
    d['geno_str'] = geno_str;
    d['ypos_base'] = violin_y((ypos_counter+1)/(2**alleles_colored.length+1));
    d['r'] = tmp_color['r'];
    d['g'] = tmp_color['g'];
    d['b'] = tmp_color['b'];
    if (first_time) d['a'] = 255;
  }
  reset_violin_y();
  d3.selectAll('.geno_label').remove();
  for (let i=0; i<alleles_colored.length; i++) {
    // making the ylabels for the violin plot
    d3.select('#yoda_svg').selectAll('.NOTHING')
      .data(Object.keys(violin_y_pos_counter))
      .enter()
      .append('text')
        .attr('class', 'geno_label')
        .attr('x', 800+i*30)
        .attr('y', function(d) { return violin_y_pos_counter[d][0]+10; })
        .html(function(d) { return d.split(" ")[i]; });
    //making headings for those labels (locus #s)
    d3.select('#yoda_svg')
      .append('text')
        .attr('class', 'geno_label')
        .attr('x', 800+i*30)
        .attr('y', violin_y(0)+20)
        .html(alleles_colored[i]+1);
    if (i==0) {
      d3.select('#yoda_svg')
        .append('text')
          .attr('class', 'geno_label')
          .attr('x', 750)
          .attr('y', violin_y(0)+20)
          .html('Locus:');
    }
  }
  

  draw_data();
  
}

// INTERACTION


function flip_allele(index, allele) {
  if (alleles_fixed[index]==allele) {
    alleles_fixed[index] = 'either';
  } else {
    alleles_fixed[index] = allele;
  }
  d3.select('#new_allele_'+String(index)).classed('locked_allele', alleles_fixed[index]=='1');
  d3.select('#wt_allele_'+String(index)).classed('locked_allele', alleles_fixed[index]=='0');
  filter_data();
}


function color_allele(index) {
  if (alleles_colored.indexOf(index)>-1) {
    alleles_colored.splice(alleles_colored.indexOf(index), 1);
  } else if (alleles_colored.length==3) {
    alleles_colored.shift();
    alleles_colored.push(index);
  } else {
    alleles_colored.push(index);
  }
  for (let i=0; i<alleles.length; i++) {
    d3.select('#allele_color_button_'+String(i)).classed('colored_allele', alleles_colored.indexOf(i)>-1);
  }
  color_data();
}

function calc_percentages(variants) {
  if ([0,main_data.length].indexOf(variants.length)==-1) {
    let allele_counts = []
    for (let i=0; i<alleles.length; i++) {
      allele_counts.push(0);
    }
    for (let v of variants) {
      for (let i=0; i<alleles.length; i++) {
        if (v[i]=='1') allele_counts[i]++;
      }
    }
    for (let i=0; i<alleles.length; i++) {
      let freq = allele_counts[i]/variants.length;
      d3.select('#allele_freq_'+String(i))
        .html(String(freq).slice(0,5))
        .style('background-color', color_by_freq(freq));

    }
  } else {
    for (let i=0; i<alleles.length; i++) {
      d3.select('#allele_freq_'+String(i))
          .html('')
          .style('background-color', 'white');
    }
  }
}

// Function that is triggered when brushing is performed
function process_brush(event) {
  let extent = event.selection;
  let variants_in_selection = [];
  if (extent[0][0] == extent[1][0]) { // zero area brush, undo it all
    for (let d of main_data) {
      d['a'] = 255;
      variants_in_selection.push(d['variant']);
    }
  } else {
    for (let d of main_data) {
      if ((extent[0][0] <= d['x'] && d['x'] <= extent[1][0] && extent[0][1] <= d['y'] && d['y'] <= extent[1][1]) ||
          (extent[0][0] <= d['kdx'] && d['kdx'] <= extent[1][0] && extent[0][1] <= d['kdy'] && d['kdy'] <= extent[1][1])) {
        d['a'] = 255;
        variants_in_selection.push(d['variant']);
      } else {
        d['a'] = 50;
      }
    }
  }
  this.variants_count = use_data.filter(d => d.a==255).length;
  d3.select('#total_var_count').html('# genotypes: ' + String(this.variants_count))
  if (variants_in_selection.length>0) calc_percentages(variants_in_selection);
  draw_brush_only();
}

function filter_data() {
  use_data = main_data.filter(function(d) {
    for (let i=0; i<alleles_fixed.length; i++) {
      if (alleles_fixed[i] != 'either') {
        if (d['variant'][i]!=alleles_fixed[i]) return false;
      }
    }
    return true;
  });
  this.variants_count = use_data.filter(d => d.a==255).length;
  d3.select('#total_var_count').html('# genotypes: ' + String(this.variants_count))
  reset_violin_y();
  draw_data();
  update_hover_map();
}

function highlight_variant(variant) {
  if (variant != 'none') {
    for (let i=0; i<variant.length; i++) {
      d3.select('#wt_allele_'+String(i)).classed('active_allele', variant[i]=='0');
      d3.select('#new_allele_'+String(i)).classed('active_allele', variant[i]=='1');
    }
  }

}

function check_for_hover_call(x, y, xe, ye, d, xo, yo) { // xo and yo are the corresponding points coordinates (from the violin plot or main plot)
  for (let i=-1*pixel_hover_range; i<pixel_hover_range+1; i++) {
    let tmp_x = x+i;
    for (let j=-1*pixel_hover_range; j<pixel_hover_range+1; j++) {
      let tmp_y = y+j;
      if ( ((tmp_x>-1) && (tmp_x<canvasWidth))  && ((tmp_y>-1) && (tmp_y<canvasHeight)) ) {
        let dist = Math.sqrt((tmp_x-xe)**2 + (tmp_y-ye)**2);
        if (dist < hoverMap[tmp_x][tmp_y]['dist']) {
          hoverMap[tmp_x][tmp_y]['dist'] = dist;
          hoverMap[tmp_x][tmp_y]['variant'] = d['variant'];
          hoverMap[tmp_x][tmp_y]['point_location'] = [x+1, y+1, xo+1, yo+1]; // TO-DO Again, this is a little hacky
        }
      }
    }
  }
}

function update_hover_map() {
  for (let i=0; i<canvasWidth; i++) {
    for (let j=0; j<canvasHeight; j++) {
      hoverMap[i][j] = {'variant': 'none', 'point_location': null, 'dist': pixel_hover_range}; 
    }
  }
  for (let d of use_data) {
    let [x, y, xe, ye, kx, ky] = [d['x'], d['y'], d['x_exact'], d['y_exact'], d['kdx'], d['kdy']];
    check_for_hover_call(x, y, xe, ye, d, kx, ky);
    //check_for_hover_call(kx, ky, kx, ky, d, x, y); // not allowing hover for violin plot points, just saying that brushing is better
  }
}

function setup_left_bar() {

  d3.selectAll('#yoda_left_bar')
    .append('div')
      .attr('id', 'total_var_count')
      .html('# genotypes: ' + String(this.variants_count));

  d3.select('#yoda_left_bar').selectAll('.allele_div')
    .data(alleles)
    .enter()
    .append('div')
      .attr('class', 'allele_div')
      .style('border-bottom', function(d, i) { return (i==alleles.length-1) ? 'none' : '1px solid black'}); //no border on last one

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele_number')
      .html(function(d, i) { return String(i+1); });

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele_color_button')
      .on('click', function(e, d) { color_allele(alleles.indexOf(d)); })
      .attr('id', function(d, i) { return 'allele_color_button_'+String(i); })
      .html('C');

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele_pos')
      .html(function(d) { return d.split('_')[1]; });

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele wt_allele')
      .on('click', function(e, d) { flip_allele(alleles.indexOf(d), '0'); })
      .attr('id', function(d, i) { return 'wt_allele_'+String(i); })
      .html(function(d) { return d.split('_')[0]; });

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele new_allele')
      .on('click', function(e, d) { flip_allele(alleles.indexOf(d), '1'); })
      .attr('id', function(d, i) { return 'new_allele_'+String(i); })
      .html(function(d) { return d.split('_')[2]; });
  
  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele_freq')
      .attr('id', function(d, i) { return 'allele_freq_'+String(i); })
      .html('');
}

function svg_diamond(x, y, size) {
  return String(x)+','+String(y-size)+' '+String(x-size)+','+String(y)+' '+String(x)+','+String(y+size)+' '+String(x+size)+','+String(y);
}

function setup_interaction() {
  update_hover_map();
  let hover_circles = [];
  for (let i=0; i<2; i++) {
    hover_circles.push(d3.select("#yoda_svg")
      .append('circle')
        .attr('r', 5)
        .attr('cx', 100)
        .attr('cy', 100)
        .attr('fill', 'none')
        .attr('stroke', '#FF0088')
        .attr('opacity', 0))
  }
  for (let v of Object.keys(color_variants)) {
    d3.select("#yoda_svg")
      .append('polygon')
        .attr('points', svg_diamond(xs(data_by_variant[v]['fdl_x']), ys(data_by_variant[v]['fdl_y']), 6))
        .attr('fill', color_variants[v])
        .attr('stroke', 'none');
  }
  
  d3.select("#yoda_svg").on('mousemove', function(event, d) {
    let [mx, my] = d3.pointer(event, this);
    let hover_el = hoverMap[Math.round(mx)][Math.round(my)];
    if (hover_el['variant'] != 'none') {
      let v = hover_el['variant'];
      highlight_variant(v);
      hover_circles[0]
        .attr('cx', hover_el['point_location'][0])
        .attr('cy', hover_el['point_location'][1])
        .attr('fill', colorMap[hover_el['variant']].formatHex())
        .attr('opacity', 1);
      hover_circles[1]
        .attr('cx', data_by_variant[v]['kdx'])
        .attr('cy', data_by_variant[v]['kdy'])
        .attr('fill', colorMap[hover_el['variant']].formatHex())
        .attr('opacity', 1);
    } else {
      highlight_variant('none');
      hover_circles[0].attr('opacity', 0);
      hover_circles[1].attr('opacity', 0);
    }
  });
  //adding violin plot axis
  kd_axis = d3.select("#yoda_svg").append('g')
    .attr('id', 'kd_axis')
    .attr("transform", "translate(0,"+String(canvasHeight-10)+")").call(d3.axisBottom().scale(x_by_kd).ticks(4));
  d3.select('#yoda_svg')
    .append('text')
      .attr('id', 'kd_axis_label')
      .attr('x', x_by_kd(8.5))
      .attr('y', canvasHeight+35)
      .html('-log10Kd');
  // adding brushing https://www.d3-graph-gallery.com/graph/interactivity_brush.html
  d3.select("#yoda_svg")
      .call( d3.brush()                 // Add the brush feature using the d3.brush function
        .extent( [ [0,0], [canvasWidth,canvasHeight] ] ) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
        .on("start brush", function(event) { process_brush(event); }) // Each time the brush selection changes, trigger the 'process_brush' function
      )
}

function get_violin_y(xpos, d) {
  if (!(d['geno_str'] in violin_y_pos_counter)) {
    violin_y_pos_counter[d['geno_str']] = [d['ypos_base'], {}];
  }
  let tmp_dict = violin_y_pos_counter[d['geno_str']][1];
  if (xpos in tmp_dict) {
    tmp_dict[xpos]++;
  } else {
    tmp_dict[xpos]=0;
  }
  return Math.round(d['ypos_base'] + ((tmp_dict[xpos] % 2)-0.5)*0.1*tmp_dict[xpos]);
}


function kd_for(kd_var_tmp) {
  kd_var = kd_var_tmp;
  if (kd_var == 'H1') {
    x_by_kd = d3.scaleLinear().domain([7,10]).range([630,790]);
    color_by_kd = d3.scaleSequential(d3.interpolateViridis).domain([7,10]);
  } else {
    x_by_kd = d3.scaleLinear().domain([6,9]).range([630,790]);
    color_by_kd = d3.scaleSequential(d3.interpolateViridis).domain([6,9]);
  }
  kd_axis.remove();
  kd_axis = d3.select("#yoda_svg").append('g')
    .attr('id', 'kd_axis')
    .attr("transform", "translate(0,"+String(canvasHeight-10)+")").call(d3.axisBottom().scale(x_by_kd).ticks(4));
  d3.selectAll('.antigen_button').classed('antigen_active', false);
  d3.select('#antigen_'+kd_var).classed('antigen_active', true);
  for (let d of main_data) {
    d['kdx'] = Math.floor(x_by_kd(Number(d[kd_var+'_log10Kd'])*-1));
    d['kd_color'] = d3.color(color_by_kd(Number(d[kd_var+'_log10Kd'])*-1));
  }
  color_data();
  draw_data();
}

function setup(fpath) {
  console.log('starting yoda viz...')
  
  d3.csv(fpath).then(function(data) {
    canvas = document.getElementById("yoda_canvas");
    ctx = canvas.getContext("2d");
    canvasData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    main_data = data;
    use_data = main_data;
    console.log(data.slice(0,10));
    let x_domain = d3.extent(main_data.map(d=>parseFloat(d.fdl_x)));
    let y_domain = d3.extent(main_data.map(d=>parseFloat(d.fdl_y)));
    let x_d_dif = x_domain[1]-x_domain[0];
    let y_d_dif = y_domain[1]-y_domain[0];
    if (x_d_dif > y_d_dif) {
      y_domain[0] = y_domain[0] - (x_d_dif-y_d_dif)/2 - x_d_dif/10; // first part makes scales equal (square), second is a buffer
      y_domain[1] = y_domain[1] + (x_d_dif-y_d_dif)/2 + x_d_dif/10;
      x_domain[0] = x_domain[0] - x_d_dif/10;
      x_domain[1] = x_domain[1] + x_d_dif/10;
    } else {
      y_domain[0] = y_domain[0] - x_d_dif/10;
      y_domain[1] = y_domain[1] + (x_d_dif-y_d_dif)/2 + x_d_dif/10;
      x_domain[0] = x_domain[0] - (y_d_dif-x_d_dif)/2 - x_d_dif/10;
      x_domain[1] = x_domain[1] + (y_d_dif-x_d_dif)/2 + x_d_dif/10;
    }
    xs = d3.scaleLinear().domain(x_domain).range([0, 600]);
    ys = d3.scaleLinear().domain(y_domain).range([600,0]);
    this.variants_count = main_data.length;
    for (let d of main_data) {
      data_by_variant[d['variant']] = d;
      d['geno_str'] = ''; //empty because no alleles are colored yet
      d['x_exact'] = xs(Number(d['fdl_x']));
      d['y_exact'] = ys(Number(d['fdl_y']));
      d['x'] = Math.floor(d['x_exact']); // TODO: make pixel interpretation technically correct
      d['y'] = Math.floor(d['y_exact']);
      d['kdx'] = Math.floor(x_by_kd(Number(d[kd_var+'_log10Kd'])*-1));
      d['kd_color'] = d3.color(color_by_kd(Number(d[kd_var+'_log10Kd'])*-1));
    }
    setup_left_bar();
    color_data(first_time=true);
    draw_data();
    setup_interaction();
  });
}


function toggle_about() {
  let new_style = (d3.select('#yoda_about_div').style('display')=='none') ? 'block' : 'none';
  d3.select('#yoda_about_div').style('display', new_style);
}