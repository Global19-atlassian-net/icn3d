/**
 * @author Jiyao Wang <wangjiy@ncbi.nlm.nih.gov> / https://github.com/ncbi/icn3d
 */

iCn3DUI.prototype.showLoading = function () { var me = this; //"use strict";
      if($("#" + me.pre + "wait")) $("#" + me.pre + "wait").show();
      if($("#" + me.pre + "canvas")) $("#" + me.pre + "canvas").hide();
      if($("#" + me.pre + "cmdlog")) $("#" + me.pre + "cmdlog").hide();
};

iCn3DUI.prototype.hideLoading = function () { var me = this; //"use strict";
    //if(me.bCommandLoad === undefined || !me.bCommandLoad) {
      if($("#" + me.pre + "wait")) $("#" + me.pre + "wait").hide();
      if($("#" + me.pre + "canvas")) $("#" + me.pre + "canvas").show();
      if($("#" + me.pre + "cmdlog")) $("#" + me.pre + "cmdlog").show();
    //}
};

iCn3DUI.prototype.downloadMmcif = function (mmcifid) { var me = this; //"use strict";
   var url, dataType;

   url = "https://files.rcsb.org/view/" + mmcifid + ".cif";

   dataType = "text";

   me.icn3d.bCid = undefined;

   document.title = mmcifid.toUpperCase() + ' (MMCIF) in iCn3D';

   $.ajax({
      url: url,
      dataType: dataType,
      cache: true,
      tryCount : 0,
      retryLimit : 1,
      beforeSend: function() {
          me.showLoading();
      },
      complete: function() {
          //me.hideLoading();
      },
      success: function(data) {
           url = me.baseUrl + "mmcifparser/mmcifparser.cgi";
           $.ajax({
              url: url,
              type: 'POST',
              data : {'mmciffile': data},
              dataType: 'jsonp',
              cache: true,
              tryCount : 0,
              retryLimit : 1,
              beforeSend: function() {
                  me.showLoading();
              },
              complete: function() {
                  //me.hideLoading();
              },
              success: function(data) {
                  me.loadMmcifData(data, mmcifid);
              },
              error : function(xhr, textStatus, errorThrown ) {
                this.tryCount++;
                if (this.tryCount <= this.retryLimit) {
                    //try again
                    $.ajax(this);
                    return;
                }
                return;
              }
            });
      },
      error : function(xhr, textStatus, errorThrown ) {
        this.tryCount++;
        if (this.tryCount <= this.retryLimit) {
            //try again
            $.ajax(this);
            return;
        }
        return;
      }
    });
};

iCn3DUI.prototype.downloadMmcifSymmetry = function (mmcifid, type) { var me = this; //"use strict";
  // chain functions together
  me.deferredSymmetry = $.Deferred(function() {
      me.downloadMmcifSymmetryBase(mmcifid, type);
  }); // end of me.deferred = $.Deferred(function() {

  return me.deferredSymmetry.promise();
};

iCn3DUI.prototype.downloadMmcifSymmetryBase = function (mmcifid, type) { var me = this; //"use strict";
   var url, dataType;

   if(me.isMac()) { // safari has a problem in getting data from https://files.rcsb.org/header/
       url = "https://files.rcsb.org/view/" + mmcifid + ".cif";
   }
   else {
       url = "https://files.rcsb.org/header/" + mmcifid + ".cif";
   }

   dataType = "text";

   me.icn3d.bCid = undefined;

   $.ajax({
      url: url,
      dataType: dataType,
      cache: true,
      tryCount : 0,
      retryLimit : 1,
      success: function(data) {
          // notebook has a problem in posting data to mmcifparser.cgi
          if(me.cfg.notebook) {
            var lines = data.split('\n');

            var bEmd = false;
            var bOrganism = false, bStartOrganism = false;
            var bMatrix = false, bStartMatrix = false, matrixLineCnt = 0, matrixStr = '', comLine = '';
            var bResidues = false, bStartResidues = false, resStr = '';

            var prevLine = '';
            for (var i in lines) {
                var line = lines[i];

                //EMDB  EMD-3906
                if(line.substr(0, 10) == 'EMDB  EMD-') {
                    me.icn3d.emd = line.substr(6).trim();
                    bEmd = true;
                }
                else if(line.substr(0, 27) == '_entity_src_nat.common_name') {
                    me.icn3d.organism = line.substr(27).trim();
                    if(me.icn3d.organism) bOrganism = true;
                    bStartOrganism = true;
                }
                else if(bStartOrganism && !bOrganism && prevLine.substr(0, 23) == '_entity_src_nat.details') {
                    //1 1 sample 1 99  Human 'Homo sapiens' 9606 ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ?
                    var itemArray = line.split(/\s+/);
                    me.icn3d.organism = (itemArray.length > 5) ? itemArray[5] : '';
                    bOrganism = true;
                }
                else if(prevLine.substr(0, 29) == '_pdbx_struct_oper_list.vector' && line.split(/\s+/).length > 2) {
                    //1 'identity operation'         1_555 x,y,z     1.0000000000  0.0000000000  0.0000000000 0.0000000000 0.0000000000  1.0000000000
                    //0.0000000000 0.0000000000 0.0000000000 0.0000000000 1.0000000000 0.0000000000

                    bStartMatrix = true;
                    ++matrixLineCnt;

                    var pos1 = line.indexOf(' ');
                    var pos2 = line.indexOf("' ");
                    comLine += line.substr(0, pos1) + line.substr(pos2 + 1);

                    matrixStr += '[';
                }
                else if(bStartMatrix && line.trim() == '#') {
                    // remove the last ','
                    if(matrixStr != '[') matrixStr = matrixStr.substr(0, matrixStr.length - 1);

                    matrixStr += ']';
                    bMatrix = true;
                    bStartMatrix = false;
                }
                else if(bStartMatrix && !bMatrix) {
                    ++matrixLineCnt;

                    if(matrixLineCnt % 2 == 0) {
                        comLine += line;
                        var itemArray = comLine.split(/\s+/);

                        if(itemArray[0] != 'X0' && itemArray[0] != 'P' && itemArray.length > 14) {
                            var m11 = itemArray[3], m12 = itemArray[4], m13 = itemArray[5], m14 = itemArray[6];
                            var m21 = itemArray[7], m22 = itemArray[8], m23 = itemArray[9], m24 = itemArray[10];
                            var m31 = itemArray[11], m32 = itemArray[12], m33 = itemArray[13], m34 = itemArray[14];

                            matrixStr += "[" + m11 + "," + m21 + "," + m31 + ", 0, " + m12 + "," + m22 + "," + m32 + ", 0, "
                              + m13 + "," + m23 + "," + m33 + ", 0, " + m14 + "," + m24 + "," + m34 + ", 1" + "],";
                        }

                        comLine = '';
                    }
                    else {
                        var pos1 = line.indexOf(' ');
                        var pos2 = line.indexOf("' ");
                        comLine += line.substr(0, pos1) + line.substr(pos2 + 1);
                    }
                }
                else if(bStartResidues && line.trim() == '#') {
                    // remove the last ','
                    if(resStr != '[') resStr = resStr.substr(0, resStr.length - 1);

                    resStr += ']';
                    bResidues = true;
                    bStartResidues = false;
                }
                else if(prevLine.trim() == '_pdbx_poly_seq_scheme.hetero' || (bStartResidues && !bResidues)) {
                    if(prevLine.trim() == '_pdbx_poly_seq_scheme.hetero') {
                        bStartResidues = true;
                        resStr += '[';
                    }

                    //A 1 1   ASP 1   1   ?   ?   ?   A . n
                    var itemArray = line.split(/\s+/);
                    var resn = itemArray[3];
                    var chain = itemArray[9];
                    var resi = itemArray[5];

                    var authResi = itemArray[6];

                    if(authResi == "?") {
                      resStr += "{\"resn\": \"" + resn + "\", \"chain\": \"" + chain + "\", \"resi\": " + resi + "},";
                    }
                }

                if(bOrganism && bMatrix && bResidues) {
                    break;
                }

                prevLine = line;
            }

            if(me.bAssemblyUseAsu) me.loadMmcifSymmetry(JSON.parse(matrixStr));

            var missingseq = JSON.parse(resStr);
            if(type === 'mmtfid' && missingseq !== undefined) {
                // adjust missing residues
                var maxMissingResi = 0, prevMissingChain = '';
                var chainMissingResidueArray = {};
                for(var i = 0, il = missingseq.length; i < il; ++i) {

                    var resn = missingseq[i].resn;
                    var chain = missingseq[i].chain;
                    var resi = missingseq[i].resi;

                    var chainNum = mmcifid + '_' + chain;

                    if(chainMissingResidueArray[chainNum] === undefined) chainMissingResidueArray[chainNum] = [];
                    var resObject = {};
                    resObject.resi = resi;
                    resObject.name = me.icn3d.residueName2Abbr(resn).toLowerCase();

                    if(chain != prevMissingChain) {
                        maxMissingResi = 0;
                    }

                    // not all listed residues are considered missing, e.g., PDB ID 4OR2, only the firts four residues are considered missing
                    if(!isNaN(resi) && (prevMissingChain == '' || (chain != prevMissingChain) || (chain == prevMissingChain && resi > maxMissingResi)) ) {
                        chainMissingResidueArray[chainNum].push(resObject);

                        maxMissingResi = resi;
                        prevMissingChain = chain;
                    }
                }

                me.icn3d.adjustSeq(chainMissingResidueArray);
            }

            if(me.deferredSymmetry !== undefined) me.deferredSymmetry.resolve();
        }
        else { // if(!me.cfg.notebook) {
           url = me.baseUrl + "mmcifparser/mmcifparser.cgi";

           $.ajax({
              url: url,
              type: 'POST',
              data : {'mmcifheader': data},
              dataType: 'jsonp',
              cache: true,
              tryCount : 0,
              retryLimit : 1,
              success: function(data) {
                  if(data.emd !== undefined) me.icn3d.emd = data.emd;
                  if(data.organism !== undefined) me.icn3d.organism = data.organism;

                  if(me.bAssemblyUseAsu) me.loadMmcifSymmetry(data);

                  if(type === 'mmtfid' && data.missingseq !== undefined) {
                        // adjust missing residues
                        var maxMissingResi = 0, prevMissingChain = '';
                        var chainMissingResidueArray = {};
                        for(var i = 0, il = data.missingseq.length; i < il; ++i) {

                            var resn = data.missingseq[i].resn;
                            var chain = data.missingseq[i].chain;
                            var resi = data.missingseq[i].resi;

                            var chainNum = mmcifid + '_' + chain;

                            if(chainMissingResidueArray[chainNum] === undefined) chainMissingResidueArray[chainNum] = [];
                            var resObject = {};
                            resObject.resi = resi;
                            resObject.name = me.icn3d.residueName2Abbr(resn).toLowerCase();

                            if(chain != prevMissingChain) {
                                maxMissingResi = 0;
                            }

                            // not all listed residues are considered missing, e.g., PDB ID 4OR2, only the firts four residues are considered missing
                            if(!isNaN(resi) && (prevMissingChain == '' || (chain != prevMissingChain) || (chain == prevMissingChain && resi > maxMissingResi)) ) {
                                chainMissingResidueArray[chainNum].push(resObject);

                                maxMissingResi = resi;
                                prevMissingChain = chain;
                            }
                        }

                        me.icn3d.adjustSeq(chainMissingResidueArray);
                  }

                  if(me.deferredSymmetry !== undefined) me.deferredSymmetry.resolve();
              },
              error : function(xhr, textStatus, errorThrown ) {
                this.tryCount++;
                if (this.tryCount <= this.retryLimit) {
                    //try again
                    $.ajax(this);
                    return;
                }

                if(me.deferredSymmetry !== undefined) me.deferredSymmetry.resolve();
                return;
              }
            });
        } // if(!me.cfg.notebook
      },
      error : function(xhr, textStatus, errorThrown ) {
        this.tryCount++;
        if (this.tryCount <= this.retryLimit) {
            //try again
            $.ajax(this);
            return;
        }

        if(me.deferredSymmetry !== undefined) me.deferredSymmetry.resolve();
        return;
      }
    });
};

iCn3DUI.prototype.loadMmcifData = function(data, mmcifid) { var me = this; //"use strict";
    if (data.atoms !== undefined) {
        me.icn3d.init();

        if(data.emd !== undefined) me.icn3d.emd = data.emd;
        if(data.organism !== undefined) me.icn3d.organism = data.organism;

        if(me.icn3d.emd !== undefined) {
          $("#" + me.pre + "mapWrapper1").hide();
          $("#" + me.pre + "mapWrapper2").hide();
          $("#" + me.pre + "mapWrapper3").hide();
        }
        else {
          $("#" + me.pre + "emmapWrapper1").hide();
          $("#" + me.pre + "emmapWrapper2").hide();
          $("#" + me.pre + "emmapWrapper3").hide();
        }

        //me.loadAtomDataIn(data, data.mmcif, 'mmcifid');
        me.deferredOpm = $.Deferred(function() {
              //me.loadMmcifOpmData(data, mmcifid);
              me.loadOpmData(data, mmcifid, undefined, 'mmcif');
        });

        return me.deferredOpm.promise();
    }
    else {
        alert('invalid atoms data.');
        return false;
    }
};

iCn3DUI.prototype.loadMmcifSymmetry = function(assembly) { var me = this; //"use strict";
    // load assembly info
    //var assembly = data.assembly;
    //var pmatrix = data.pmatrix;

    for(var i = 0, il = assembly.length; i < il; ++i) {
      var mat4 = new THREE.Matrix4();
      mat4.fromArray(assembly[i]);

      me.icn3d.biomtMatrices[i] = mat4;
    }

    me.icn3d.asuCnt = me.icn3d.biomtMatrices.length;
};

iCn3DUI.prototype.parseMmdbDataPart1 = function (data, type) { var me = this; //"use strict";
        // if type is defined, always process target before query
        if(data.atoms === undefined && data.molid2rescount === undefined) {
            alert('invalid MMDB data.');
            return false;
        }

        if(type === undefined || type === 'target') {
            me.icn3d.init();

            me.icn3d.chainsColor = {};
            me.icn3d.chainsGene = {};
        }

        // used in download2Ddgm()
        if(type === 'query') {
            me.interactionData_q = {"moleculeInfor": data.moleculeInfor, "intrac": data.intrac, "intracResidues": data.intracResidues};
        }
        else {
            me.interactionData = {"moleculeInfor": data.moleculeInfor, "intrac": data.intrac, "intracResidues": data.intracResidues};
        }

        if(type === 'query') {
            me.mmdb_data_q = data;
        }
        else {
            me.mmdb_data = data;
        }

        var id = (data.pdbId !== undefined) ? data.pdbId : data.mmdbId;
        if(type === 'query') {
            me.inputid2 = id;
        }
        else {
            me.inputid = id;
        }

        // get molid2color = {}, chain2molid = {}, molid2chain = {};
        var labelsize = 40;

        var molid2rescount = data.moleculeInfor;
        var molid2color = {}, chain2molid = {}, molid2chain = {};

        //var html = "<table width='100%'><tr><td></td><th>#</th><th align='center'>Chain</th><th align='center'>Residue Count</th></tr>";

        var index = 1;
        var chainNameHash = {};
        for(var i in molid2rescount) {
          if(Object.keys(molid2rescount[i]).length === 0) continue;

          var color = (molid2rescount[i].color === undefined) ? '#CCCCCC' : '#' + ( '000000' + molid2rescount[i].color.toString( 16 ) ).slice( - 6 );
          var chainName = (molid2rescount[i].chain === undefined) ? '' : molid2rescount[i].chain.trim();
          if(chainNameHash[chainName] === undefined) {
              chainNameHash[chainName] = 1;
          }
          else {
              ++chainNameHash[chainName];
          }

          var chainNameFinal = (chainNameHash[chainName] === 1) ? chainName : chainName + chainNameHash[chainName].toString();
          var chain = id + '_' + chainNameFinal;

          molid2color[i] = color;
          chain2molid[chain] = i;
          molid2chain[i] = chain;

          me.icn3d.chainsColor[chain] = (type !== undefined) ? new THREE.Color(me.GREY8) : new THREE.Color(color);

          var geneId = (molid2rescount[i].geneId === undefined) ? '' : molid2rescount[i].geneId;
          var geneSymbol = (molid2rescount[i].geneSymbol === undefined) ? '' : molid2rescount[i].geneSymbol;
          var geneDesc = (molid2rescount[i].geneDesc === undefined) ? '' : molid2rescount[i].geneDesc;
          me.icn3d.chainsGene[chain] = {'geneId': geneId, 'geneSymbol': geneSymbol, 'geneDesc': geneDesc};
          ++index;
        }

        //if(me.icn3d.chemicals !== undefined && Object.keys(me.icn3d.chemicals).length > 0) {
        //  html += "<tr><td><input type='checkbox' name='" + me.pre + "filter_ckbx' value='chemicals'/></td><td align='center'>" + index + "</td><td align='center'>Chemicals</td><td align='center'>" + Object.keys(me.icn3d.chemicals).length + " atoms</td></tr>";
        //}

        //html += "</table>";

        //me.icn3d.molid2color = (type === 'query') ? me.icn3d.unionHash(me.icn3d.molid2color, molid2color) : molid2color;
        //me.icn3d.chain2molid = (type === 'query') ? me.icn3d.unionHash(me.icn3d.chain2molid, chain2molid) : chain2molid;
        //me.icn3d.molid2chain = (type === 'query') ? me.icn3d.unionHash(me.icn3d.molid2chain, molid2chain) : molid2chain;

        me.icn3d.molid2color = molid2color;
        me.icn3d.chain2molid = chain2molid;
        me.icn3d.molid2chain = molid2chain;

        //if ((me.cfg.inpara !== undefined && me.cfg.inpara.indexOf('mols=') != -1) || (data.atomCount <= maxatomcnt && data.atoms !== undefined) ) {
        // small structure with all atoms
        // show surface options
        $("#" + me.pre + "accordion5").show();

        //me.loadAtomDataIn(data, id, 'mmdbid', undefined, type);
};

iCn3DUI.prototype.parseMmdbData = function (data, type) { var me = this; //"use strict";
        if(type === undefined) {
            //me.deferredOpm = $.Deferred(function() {
                  var id = (data.pdbId !== undefined) ? data.pdbId : data.mmdbId;

                  me.loadMmdbOpmData(data, id, type);
            //});

            //return me.deferredOpm.promise();
        }
        else {
            me.parseMmdbDataPart1(data, type);

            var id = (data.pdbId !== undefined) ? data.pdbId : data.mmdbId;

            me.loadAtomDataIn(data, id, 'mmdbid', undefined, type);

            me.loadMmdbOpmDataPart2(data, id, type);
        }
};

iCn3DUI.prototype.downloadMmdb = function (mmdbid, bGi) { var me = this; //"use strict";
   //var maxatomcnt = (me.cfg.maxatomcnt === undefined) ? 50000 : me.cfg.maxatomcnt;
   //var maxatomcnt = 100000; // asymmetric unit (buidx=0) will be returned if above this threshold

   var url;

   // b: b-factor, s: water, ft: pdbsite
   //&ft=1
   if(bGi) {
       url = me.baseUrl + "mmdb/mmdb_strview.cgi?v=2&program=icn3d&b=1&s=1&ft=1&gi=" + mmdbid;
   }
   else {
       url = me.baseUrl + "mmdb/mmdb_strview.cgi?v=2&program=icn3d&b=1&s=1&ft=1&uid=" + mmdbid;
   }

   // use asymmetric unit for BLAST search, e.g., https://www.ncbi.nlm.nih.gov/Structure/icn3d/full.html?from=blast&blast_rep_id=5XZC_B&query_id=1TUP_A&command=view+annotations;set+annotation+cdd;set+annotation+site;set+view+detailed+view;select+chain+5XZC_B;show+selection&log$=align&blast_rank=1&RID=EPUCYNVV014&buidx=0
   if(me.cfg.blast_rep_id !== undefined) url += '&buidx=0';

   me.icn3d.bCid = undefined;

   if(me.cfg.inpara !== undefined) {
     url += me.cfg.inpara;
   }

   if(me.chainids2resids === undefined) me.chainids2resids = {}; // me.chainids2resids[chainid1][chainid2] = [resid, resid]

   $.ajax({
      url: url,
      dataType: 'jsonp',
      cache: true,
      tryCount : 0,
      retryLimit : 1,
      beforeSend: function() {
          me.showLoading();
      },
      complete: function() {
          //me.hideLoading();
      },
      success: function(data) {
        var bCalphaOnly = me.icn3d.isCalphaPhosOnly(data.atoms); //, 'CA');

        if(bCalphaOnly || data.atomCount <= me.icn3d.maxatomcnt) {
            me.parseMmdbData(data);
        }
        else {
            data = null;

            $.ajax({
              url: url + '&complexity=2', // alpha carbons
              dataType: 'jsonp',
              cache: true,
              tryCount : 0,
              retryLimit : 1,
              beforeSend: function() {
                  me.showLoading();
              },
              complete: function() {
                  //me.hideLoading();
              },
              success: function(data2) {
                  me.parseMmdbData(data2);
              },
              error : function(xhr, textStatus, errorThrown ) {
                this.tryCount++;
                if (this.tryCount <= this.retryLimit) {
                    //try again
                    $.ajax(this);
                    return;
                }

                if(bGi) {
                  alert("This gi " + mmdbid + " has no corresponding 3D structure...");
                }
                else {
                  alert("This mmdbid " + mmdbid + " with the parameters " + me.cfg.inpara
                    + " may not have 3D structure data. Please visit the summary page for details: " + me.baseUrl + "pdb/" + mmdbid);
                }

                return;
              } // success
            }); // ajax
        }
      },
      error : function(xhr, textStatus, errorThrown ) {
        this.tryCount++;
        if (this.tryCount <= this.retryLimit) {
            //try again
            $.ajax(this);
            return;
        }

        if(bGi) {
          alert("This gi " + mmdbid + " has no corresponding 3D structure...");
        }
        else {
          alert("This mmdbid " + mmdbid + " with the parameters " + me.cfg.inpara
            + " may not have 3D structure data. Please visit the summary page for details: " + me.baseUrl + "pdb/" + mmdbid);
        }

        return;
      } // success
    }); // ajax
};

iCn3DUI.prototype.downloadMmdbPart2 = function (type) { var me = this; //"use strict";
    if(me.bAssemblyUseAsu) { // set up symmetric matrices
        $("#" + me.pre + "assemblyWrapper").show();
        me.icn3d.bAssembly = true;
    }
    else {
        $("#" + me.pre + "assemblyWrapper").hide();
        me.icn3d.bAssembly = false;
    }

    if(me.icn3d.emd !== undefined) {
      $("#" + me.pre + "mapWrapper1").hide();
      $("#" + me.pre + "mapWrapper2").hide();
      $("#" + me.pre + "mapWrapper3").hide();
    }
    else {
      $("#" + me.pre + "emmapWrapper1").hide();
      $("#" + me.pre + "emmapWrapper2").hide();
      $("#" + me.pre + "emmapWrapper3").hide();
    }

    me.icn3d.setAtomStyleByOptions(me.opts);
    // use the original color from cgi output
    if(me.cfg.blast_rep_id !== undefined) {
      me.icn3d.setColorByOptions(me.opts, me.icn3d.atoms);
    }
    else {
      me.icn3d.setColorByOptions(me.opts, me.icn3d.atoms, true);
    }

    if(type === undefined) {
        me.renderStructure();
        if(me.cfg.rotate !== undefined) me.rotStruc(me.cfg.rotate, true);

        me.html2ddgm = '';
        if(me.cfg.show2d) {
            me.openDialog(me.pre + 'dl_2ddgm', 'Interactions');
            if(me.bFullUi) {
                if(type === undefined) {
                    me.download2Ddgm(me.inputid.toUpperCase());
                }
                else {
                    me.set2DDiagramsForAlign(me.inputid2.toUpperCase(), me.inputid.toUpperCase());
                }
            }
        }
    }

    if( (me.cfg.align === undefined || me.cfg.chainalign === undefined) && Object.keys(me.icn3d.structures).length == 1) {
        if($("#" + me.pre + "alternateWrapper") !== null) $("#" + me.pre + "alternateWrapper").hide();
    }

    //if(me.deferred !== undefined) me.deferred.resolve(); if(me.deferred2 !== undefined) me.deferred2.resolve();
};

iCn3DUI.prototype.downloadGi = function (gi) { var me = this; //"use strict";
    me.icn3d.bCid = undefined;
    var bGi = true;
    me.downloadMmdb(gi, bGi);
};

iCn3DUI.prototype.downloadBlast_rep_id = function (sequence_structure_ids) { var me = this; //"use strict";
    me.icn3d.bCid = undefined;

    var idArray = sequence_structure_ids.split(',');
    me.cfg.query_id = idArray[0];
    me.cfg.blast_rep_id = idArray[1];

    var mmdbid = me.cfg.blast_rep_id.split('_')[0];

    me.downloadMmdb(mmdbid);
};

iCn3DUI.prototype.getMissingResidues = function (seqArray, type, chainid) { var me = this; //"use strict";
    var prevResi = -9999;
    var missingResBegin = 0;
    var bCount = true;

    for(var i = 0, il = seqArray.length; i < il; ++i) {
        var seqName, resiPos;
        // mmdbid: ["0","R","ARG"],["502","V","VAL"]; mmcifid: [1, "ARG"]; align: [1, "0","R","ARG"]
        if(type === 'mmdbid') {
            seqName = seqArray[i][1];
            resiPos = 0;
        }
        else if(type === 'mmcifid') {
            seqName = seqArray[i][1];
            seqName = me.icn3d.residueName2Abbr(seqName);
            resiPos = 0;
        }
        else if(type === 'align') {
            seqName = seqArray[i][2];
            resiPos = 1;
        }

        // fixe some missing residue names such as residue 6 in 5C1M_A
        if(seqName === '') {
            seqName = 'x';
        }

        var resObject = {};
        resObject.resi = i + 1;
        var resi = parseInt(seqArray[i][resiPos]);
        var nextResi = (i == il - 1) ? 9999 : parseInt(seqArray[i+1][resiPos]);

        if(resi !== 0 ||
          (resi === 0 && (prevResi === -1 || nextResi == 1) )
          ) {
            resObject.name = seqName.toLowerCase();

            if(bCount && missingResBegin > 0) {
                if(me.countNextresiArray[chainid] === undefined) me.countNextresiArray[chainid] = [];

                var count_nextresi = [missingResBegin, parseInt(seqArray[i][0])];

                me.countNextresiArray[chainid].push(count_nextresi);

                missingResBegin = 0;
            }

            bCount = false;
        }
        //else if(resi === 0 && prevResi !== -1) { // sometimes resi could be -4, -3, -2, -1, 0 e.g., PDBID 4YPS
        else { // sometimes resi could be -4, -3, -2, -1, 0 e.g., PDBID 4YPS
            resObject.name = seqName.toLowerCase();
            ++missingResBegin;

            //if(me.chainMissingResidueArray[chainid] === undefined) me.chainMissingResidueArray[chainid] = [];
            //me.chainMissingResidueArray[chainid].push(resObject);

            bCount = true;
        }

        if(me.icn3d.chainsSeq[chainid] === undefined) me.icn3d.chainsSeq[chainid] = [];

        var numberStr = '';
        if(resObject.resi % 10 === 0) numberStr = resObject.resi.toString();

        me.icn3d.chainsSeq[chainid].push(resObject);

        prevResi = resi;
    }
};

//type: "mmdbid", "mmcifid", "align"
//alignType: "query", "target" for chain to chain 3D alignment
iCn3DUI.prototype.loadAtomDataIn = function (data, id, type, seqalign, alignType) { var me = this; //"use strict";
    //me.icn3d.init();
    me.icn3d.pmin = new THREE.Vector3( 9999, 9999, 9999);
    me.icn3d.pmax = new THREE.Vector3(-9999,-9999,-9999);
    me.icn3d.psum = new THREE.Vector3();

    var atoms = data.atoms;

    var serialBase = (alignType === undefined || alignType === 'target') ? 0 : me.lastTargetSerial;
    var serial = serialBase;
    var prevResi = 0;

    var serial2structure = {}; // for "align" only
    var mmdbid2pdbid = {}; // for "align" only

    if(alignType === undefined || alignType === 'target') {
        me.pmid = data.pubmedId;

        me.chainid2title = {};
        me.chainid2sid = {};
    }
    else {
        me.pmid2 = data.pubmedId;
    }

    var chainid2seq = {}, chainid2kind = {}, chainid2color = {};

    if(type === 'align') {
      //serial2structure
      me.pmid = "";
      var refinedStr = (me.cfg.inpara.indexOf('atype=1') !== -1) ? 'Invariant Core ' : '';
      me.icn3d.molTitle = refinedStr + 'Structure Alignment of ';

      for (var i = 0, il = data.alignedStructures[0].length; i < il; ++i) {
          var structure = data.alignedStructures[0][i];

          if(i === 1) {
              me.icn3d.secondId = structure.pdbId; // set the second pdbid to add indent in the structure and chain mns
          }

          var pdbidTmp = structure.pdbId;
          var mmdbidTmp = structure.mmdbId;

          for(var j = structure.serialInterval[0], jl = structure.serialInterval[1]; j <= jl; ++j) {
              serial2structure[j] = pdbidTmp.toString();
              mmdbid2pdbid[mmdbidTmp] = pdbidTmp;
          }

          for(var j = 0, jl = structure.molecules.length; j < jl; ++j) {
              var chain = structure.molecules[j].chain;
              var kind = structure.molecules[j].kind;
              var title = structure.molecules[j].name;
              var seq = structure.molecules[j].sequence;
              var sid = structure.molecules[j].sid;

              var chainid = pdbidTmp + '_' + chain;

              if(me.bFullUi) chainid2seq[chainid] = seq;
              chainid2kind[chainid] = kind;

              me.chainid2title[chainid] = title;
              if(sid !== undefined) me.chainid2sid[chainid] = sid;
          }

          me.icn3d.molTitle +=  "<a href=\"" + me.baseUrl + "mmdb/mmdbsrv.cgi?uid=" + structure.pdbId.toUpperCase() + "\" target=\"_blank\">" + structure.pdbId.toUpperCase() + "</a>";

          if(structure.descr !== undefined) me.pmid += structure.descr.pubmedid;
          if(i === 0) {
              me.icn3d.molTitle += " and ";
              if(structure.descr !== undefined) me.pmid += "_";
          }
      }

      me.icn3d.molTitle += ' from VAST+';

    }
    else { // mmdbid or mmcifid
        if(data.descr !== undefined) me.icn3d.molTitle += data.descr.name;

        if(type === 'mmdbid') {
          var pdbidTmp = data.pdbId;
          var chainHash = {};

          if(alignType == 'target') {
            me.alignmolid2color = [];
            me.alignmolid2color[0] = {};
            me.alignmolid2color[1] = {};
          }

          var molidCnt = 1;
          for(var molid in data.moleculeInfor) {
              if(Object.keys(data.moleculeInfor[molid]).length === 0) continue;

              var chain = data.moleculeInfor[molid].chain.trim();
              var chainid = pdbidTmp + '_' + chain;

              if(chainHash.hasOwnProperty(chain)) {
                  ++chainHash[chain];
                  chainid += chainHash[chain];
              }
              else {
                  chainHash[chain] = 1;
              }

              if(me.mmdbid_q !== undefined && me.mmdbid_q === me.mmdbid_t && alignType === 'query') {
                  //chainid += me.postfix;
                  chainid = pdbidTmp + me.postfix + '_' + chain;
              }

              var kind = data.moleculeInfor[molid].kind;
              var color = data.moleculeInfor[molid].color;
              var sid = data.moleculeInfor[molid].sid;

              chainid2kind[chainid] = kind;
              chainid2color[chainid] = color;

              if(kind == 'protein') me.icn3d.organism = data.moleculeInfor[molid].taxonomyName.toLowerCase();

              if(sid !== undefined) me.chainid2sid[chainid] = sid;

              if(me.icn3d.pdbid_chain2title === undefined) me.icn3d.pdbid_chain2title = {};
              me.icn3d.pdbid_chain2title[chainid] = data.moleculeInfor[molid].name;

              if(alignType == 'query' && chain == me.chain_q) {
                  me.alignmolid2color[0][molid] = molidCnt.toString();
              }
              else if(alignType == 'target' && chain == me.chain_t) {
                  me.alignmolid2color[1][molid] = molidCnt.toString();
              }

              ++molidCnt;
          }
        }
    }

    me.countNextresiArray = {};
    //me.chainMissingResidueArray = {};
    if(me.bFullUi) {
        if(type === 'mmdbid' || type === 'mmcifid') {
            for(var chain in data.sequences) {
                var seqArray = data.sequences[chain];
                var chainid = id + '_' + chain;

                if(me.mmdbid_q !== undefined && me.mmdbid_q === me.mmdbid_t && alignType === 'query') {
                    //chainid += me.postfix;
                    chainid = id + me.postfix + '_' + chain;
                }

                me.getMissingResidues(seqArray, type, chainid); // assign me.icn3d.chainsSeq
            }
        }
        else if(type === 'align') {
            for(var chainid in chainid2seq) {
                var seqArray = chainid2seq[chainid];

                me.getMissingResidues(seqArray, type, chainid);
            }
        }
    }

    var atomid2serial = {};
    var prevStructureNum = '', prevChainNum = '', prevResidueNum = '';
    var structureNum = '', chainNum = '', residueNum = '';
    var currContinueSeq = '';
    var oldResi, prevOldResi = -999;
    var prevResi = 0; // continuous from 1 for each chain
    var missingResIndex = 0;
    var bChainSeqSet = true;
    var bAddedNewSeq = false;

    // In align, chemicals do not have assigned chains. Assembly will have the same residue id so that two different residues will be combined in one residue. To avoid this, build an array to check for molid
    var resiArray = [];
    var molid, prevMolid = '', prevmmdbId = '';

    var bPhosphorusOnly = me.icn3d.isCalphaPhosOnly(atoms); //, "O3'", "O3*") || me.icn3d.isCalphaPhosOnly(atoms, "P");
    var miscCnt = 0;
    var CSerial, prevCSerial, OSerial, prevOSerial;

    var biopolymerChainsHash = {};

    for (var i in atoms) {
        ++serial;

        atomid2serial[i] = serial;

        var atm = atoms[i];
        atm.serial = serial;

        var mmdbId;

        if(type === 'mmdbid' || type === 'mmcifid') {
          mmdbId = id; // here mmdbId is pdbid or mmcif id
        }
        else if(type === 'align') {
          mmdbId = serial2structure[serial]; // here mmdbId is pdbid
        }

        var resiCorrection = 0;
        if(type === 'mmdbid' || type === 'align') {
            atm.resi_ori = parseInt(atm.resi); // original PDB residue number, has to be integer
            atm.resi = atm.ids.r; // corrected for residue insertion code

            resiCorrection = atm.resi - atm.resi_ori;

            var pos = atm.resn.indexOf(' ');
            if(pos !== -1 && pos != 0) atm.resn = atm.resn.substr(0, pos);
        }
        else {
            atm.resi = parseInt(atm.resi);
        }

        //if(mmdbId !== prevmmdbId) resiArray = [];
        if(atm.chain === undefined && (type === 'mmdbid' || type === 'align')) {
            if(type === 'mmdbid') {
              molid = atm.ids.m;

              if(me.icn3d.molid2chain[molid] !== undefined) {
                  var pos = me.icn3d.molid2chain[molid].indexOf('_');
                  atm.chain = me.icn3d.molid2chain[molid].substr(pos + 1);
              }
              else {
                  var miscName = 'Misc';

                  ++miscCnt;
                  if(chainid2kind[chainNum] === 'solvent' || atm.resn === 'HOH') {
                      atm.resi = miscCnt;
                  }

                  //if all are defined in the chain section, no "Misc" should appear
                  atm.chain = miscName;
              }

              //if(me.mmdbid_q !== undefined && me.mmdbid_q === me.mmdbid_t && alignType === 'query') {
                  //atm.chain += me.postfix;
              //}
            }
            else if(type === 'align') {
              molid = atm.ids.m;

              if(me.icn3d.pdbid_molid2chain[mmdbId + '_' + molid] !== undefined) {
                  atm.chain = me.icn3d.pdbid_molid2chain[mmdbId + '_' + molid];
              }
              else {
                  var miscName = 'Misc';
                  ++miscCnt;
                  if(chainid2kind[chainNum] === 'solvent' || atm.resn === 'HOH') {
                      atm.resi = miscCnt;
                  }

                  // chemicals do not have assigned chains.
                  atm.chain = miscName;
              }
            }
        }
        else {
          atm.chain = (atm.chain === '') ? 'Misc' : atm.chain;
        }

        atm.chain = atm.chain.trim();

        // mmcif has pre-assigned structure in mmcifparser.cgi output
        if(type === 'mmdbid' || type === 'align') {
            atm.structure = mmdbId;

            if(type === 'mmdbid' && me.mmdbid_q !== undefined && me.mmdbid_q === me.mmdbid_t && alignType === 'query') {
                atm.structure += me.postfix;
            }
        }

        structureNum = atm.structure;

        chainNum = structureNum + '_' + atm.chain;
        //if(me.mmdbid_q !== undefined && me.mmdbid_q === me.mmdbid_t && alignType === 'query') chainNum += me.postfix;

        if(chainNum !== prevChainNum) {
            missingResIndex = 0;
            prevResi = 0;
        }

        if(atm.resi !== prevResi) {
            if(chainNum !== prevChainNum) {
                prevCSerial = undefined;
                prevOSerial = undefined;
            }
            else {
                prevCSerial = CSerial;
                prevOSerial = OSerial;
            }
        }

        if(type === 'mmdbid') {
            atm.coord = new THREE.Vector3(atm.coord[0], atm.coord[1], atm.coord[2]);

            if(me.q_rotation !== undefined) {
                if(alignType === 'target') {
                    atm.coord.x += me.t_trans_add.x;
                    atm.coord.y += me.t_trans_add.y;
                    atm.coord.z += me.t_trans_add.z;
                }
                else if(alignType === 'query') {
                    atm.coord.x -= me.q_trans_sub.x;
                    atm.coord.y -= me.q_trans_sub.y;
                    atm.coord.z -= me.q_trans_sub.z;

                    var x = atm.coord.x * me.q_rotation.x1 + atm.coord.y * me.q_rotation.y1 + atm.coord.z * me.q_rotation.z1;
                    var y = atm.coord.x * me.q_rotation.x2 + atm.coord.y * me.q_rotation.y2 + atm.coord.z * me.q_rotation.z2;
                    var z = atm.coord.x * me.q_rotation.x3 + atm.coord.y * me.q_rotation.y3 + atm.coord.z * me.q_rotation.z3;

                    atm.coord.x = x;
                    atm.coord.y = y;
                    atm.coord.z = z;
                }
            }
        }
        else {
            atm.coord = new THREE.Vector3(atm.coord.x, atm.coord.y, atm.coord.z);
        }

        var oneLetterRes = me.icn3d.residueName2Abbr(atm.resn.substr(0, 3));

        if( (type === 'mmdbid' || type === 'align') && me.bFullUi ) {
            // set me.mmdbMolidResid2mmdbChainResi
            if(me.mmdbMolidResid2mmdbChainResi === undefined) me.mmdbMolidResid2mmdbChainResi = {};
            me.mmdbMolidResid2mmdbChainResi[mmdbId + '_' + atm.ids.m + '_' + atm.ids.r] = mmdbId + '_' + atm.chain + '_' + atm.resi;
        }

        me.icn3d.pmin.min(atm.coord);
        me.icn3d.pmax.max(atm.coord);
        me.icn3d.psum.add(atm.coord);

        var bProtein = (me.cfg.mmcifid === undefined) ? chainid2kind[chainNum] === 'protein' : atm.mt === 'p';
        var bNucleotide = (me.cfg.mmcifid === undefined) ? chainid2kind[chainNum] === 'nucleotide' : atm.mt === 'n';
        var bSolvent = (me.cfg.mmcifid === undefined) ? chainid2kind[chainNum] === 'solvent' : atm.mt === 's';
        // in vastplus.cgi, ions arenotlisted in alignedStructures...molecules, thus chainid2kind[chainNum] === undefined is used.
        // ions will be separated from chemicals later.
        // here "ligand" is used in the cgi output
        //var bChemicalIons = (me.cfg.mmcifid === undefined) ? (chainid2kind[chainNum] === 'ligand' || chainid2kind[chainNum] === 'otherPolymer' || chainid2kind[chainNum] === undefined) : atm.mt === 'l';
        // kind: other, otherPolymer, etc
        var bChemicalIons = (me.cfg.mmcifid === undefined) ? (chainid2kind[chainNum] === 'ligand' || (chainid2kind[chainNum] !== undefined && chainid2kind[chainNum].indexOf('other') !== -1) || chainid2kind[chainNum] === undefined) : atm.mt === 'l';

        if((atm.chain === 'Misc' || chainid2kind[chainNum] === 'other') && biopolymerChainsHash[chainNum] !== 'protein' && biopolymerChainsHash[chainNum] !== 'nucleotide') { // biopolymer, could be protein or nucleotide
            if(atm.name === 'CA') {
                biopolymerChainsHash[chainNum] = 'protein';
            }
            else if(atm.name === 'P') {
                biopolymerChainsHash[chainNum] = 'nucleotide';
            }
            else {
                biopolymerChainsHash[chainNum] = 'chemical';
            }
        }

/*
        // sometimes proteins or nucleotide may input as chemicals
        // use the hash residueColors for protein residues
        var nucleotideRes = {'G': 1, 'A': 1, 'T': 1, 'C': 1, 'U': 1, 'DG': 1, 'DA': 1, 'DT': 1, 'DC': 1, 'DU': 1};
        if(me.icn3d.residueColors.hasOwnProperty(atm.resn)) {
            bProtein = true;
        }
        else if(nucleotideRes.hasOwnProperty(atm.resn)) {
            bNucleotide = true;
        }
*/

        if (bProtein || bNucleotide)
        {
            if (bProtein) {
              me.icn3d.proteins[serial] = 1;

              if (atm.name === 'CA') me.icn3d.calphas[serial] = 1;
              if (atm.name !== 'N' && atm.name !== 'CA' && atm.name !== 'C' && atm.name !== 'O') me.icn3d.sidec[serial] = 1;
            }
            else if (bNucleotide) {
              me.icn3d.nucleotides[serial] = 1;

              //if (atm.name == 'P') me.icn3d.nucleotidesO3[serial] = 1;
              if (atm.name == "O3'" || atm.name == "O3*" || (bPhosphorusOnly && atm.name == 'P') ) {
                  me.icn3d.nucleotidesO3[serial] = 1;
              }
            }

            atm.het = false;
        }
        else if (bSolvent) { // solvent
          me.icn3d.water[serial] = 1;

          atm.het = true;
        }
        else if (bChemicalIons) { // chemicals and ions
          //if (atm.bonds.length === 0) me.icn3d.ions[serial] = 1;
          if (atm.resn === 'HOH' || atm.resn === 'O') {
              me.icn3d.water[serial] = 1;
          }
          else if (atm.elem === atm.resn) {
              me.icn3d.ions[serial] = 1;
          }
          else {
              me.icn3d.chemicals[serial] = 1;
          }

          atm.het = true;
        }

        if(type === 'mmdbid') {
            if(!atm.het) {
                atm.color = (chainid2color[chainNum] !== undefined) ? new THREE.Color(chainid2color[chainNum]) : me.icn3d.chargeColors[atm.resn];
            }
            else {
                atm.color = me.icn3d.atomColors[atm.elem] || me.icn3d.defaultAtomColor;
            }
        }
        else {
            if(atm.color !== undefined) atm.color = new THREE.Color(atm.color);
        }

        if(atm.resn.charAt(0) !== ' ' && atm.resn.charAt(1) === ' ') {
          atm.resn = atm.resn.charAt(0);
        }

        if(!atm.het && atm.name === 'C') {
            CSerial = serial;
        }
        if(!atm.het && atm.name === 'O') {
            OSerial = serial;
        }

        // from DSSP C++ code
        if(!atm.het && atm.name === 'N' && prevCSerial !== undefined && prevOSerial !== undefined) {
            var dist = me.icn3d.atoms[prevCSerial].coord.distanceTo(me.icn3d.atoms[prevOSerial].coord);

            var x2 = atm.coord.x + (me.icn3d.atoms[prevCSerial].coord.x - me.icn3d.atoms[prevOSerial].coord.x) / dist;
            var y2 = atm.coord.y + (me.icn3d.atoms[prevCSerial].coord.y - me.icn3d.atoms[prevOSerial].coord.y) / dist;
            var z2 = atm.coord.z + (me.icn3d.atoms[prevCSerial].coord.z - me.icn3d.atoms[prevOSerial].coord.z) / dist;

            atm.hcoord = new THREE.Vector3(x2, y2, z2);
        }

        // double check
        if (atm.resn == 'HOH') me.icn3d.water[serial] = 1

        me.icn3d.atoms[serial] = atm;
        me.icn3d.dAtoms[serial] = 1;
        me.icn3d.hAtoms[serial] = 1;

        // chain level
        var chainid = atm.structure + '_' + atm.chain;
        //if(me.mmdbid_q !== undefined && me.mmdbid_q === me.mmdbid_t && alignType === 'query') chainid += me.postfix;

        if (me.icn3d.chains[chainid] === undefined) me.icn3d.chains[chainid] = {};
        me.icn3d.chains[chainid][serial] = 1;

        // residue level
        var residueid = chainid + '_' + atm.resi;
        if (me.icn3d.residues[residueid] === undefined) me.icn3d.residues[residueid] = {};
        me.icn3d.residues[residueid][serial] = 1;

        residueNum = chainNum + '_' + atm.resi;

        // different residue
        if(residueNum !== prevResidueNum) {
            // different chain
            if(chainNum !== prevChainNum) {
                bChainSeqSet = true;

                //if(serial !== 1) {
                if(prevStructureNum !== '') {
                    if(me.icn3d.structures[prevStructureNum] === undefined) me.icn3d.structures[prevStructureNum] = [];
                    me.icn3d.structures[prevStructureNum].push(prevChainNum);
                }
            }
        }

        me.icn3d.residueId2Name[residueid] = oneLetterRes;

        var secondaries = '-';
        if(atm.ss === 'helix') {
            secondaries = 'H';
        }
        else if(atm.ss === 'sheet') {
            secondaries = 'E';
        }
        else if(atm.het || bNucleotide ) {
            secondaries = 'o';
        }
        else if(!atm.het && me.icn3d.residueColors.hasOwnProperty(atm.resn.toUpperCase()) ) {
            secondaries = 'c';
        }
        else if(atm.ss === 'coil') {
            secondaries = 'c';
        }

        me.icn3d.secondaries[atm.structure + '_' + atm.chain + '_' + atm.resi] = secondaries;

        if( (atm.resi != prevResi || molid != prevMolid) && me.bFullUi) { // mmdbid 1tup has different molid, same resi
          if(me.icn3d.chainsSeq[chainid] === undefined) {
              me.icn3d.chainsSeq[chainid] = [];
              bChainSeqSet = false;
          }

          // me.icn3d.chainsSeq[chainid][atm.resi - 1] should have been defined for major chains
          if( bChainSeqSet && !bAddedNewSeq && me.icn3d.chainsSeq[chainid][atm.resi - 1] !== undefined) {
              me.icn3d.chainsSeq[chainid][atm.resi - 1].name = oneLetterRes;
          }
          else if(!bChainSeqSet || !me.icn3d.chainsSeq[chainid].hasOwnProperty(atm.resi - 1)) {
              var resObject = {};
              resObject.resi = atm.resi;
              resObject.name = oneLetterRes;
              var numberStr = '';
              if(atm.resi % 10 === 0) numberStr = atm.resi.toString();

              me.icn3d.chainsSeq[chainid].push(resObject);

              bAddedNewSeq = true;
          }
        }

        prevResi = atm.resi;

        prevStructureNum = structureNum;
        prevChainNum = chainNum;
        prevResidueNum = residueNum;

        prevMolid = molid;
        prevmmdbId = mmdbId;
    }

    if(alignType === 'target') me.lastTargetSerial = serial;

    // adjust biopolymer type
    for(var chainid in biopolymerChainsHash) {
        if(Object.keys(me.icn3d.chains[chainid]).length < 10) continue;

        if(biopolymerChainsHash[chainid] === 'chemical') continue;

        for(var serial in me.icn3d.chains[chainid]) {
            var atm = me.icn3d.atoms[serial];

            delete me.icn3d.chemicals[serial];
            atm.het = false;

            if(biopolymerChainsHash[chainid] === 'protein') {
              me.icn3d.proteins[serial] = 1;

              if (atm.name === 'CA') me.icn3d.calphas[serial] = 1;
              if (atm.name !== 'N' && atm.name !== 'CA' && atm.name !== 'C' && atm.name !== 'O') me.icn3d.sidec[serial] = 1;
            }
            else if(biopolymerChainsHash[chainid] === 'nucleotide') {
              me.icn3d.nucleotides[serial] = 1;
              //atm.style = 'nucleotide cartoon';

              if (atm.name == "O3'" || atm.name == "O3*" || (bPhosphorusOnly && atm.name == 'P') ) {
                  me.icn3d.nucleotidesO3[serial] = 1;
              }
            }
        }
    }

    // me.icn3d.adjustSeq(me.chainMissingResidueArray);

    // add the last residue set
    if(me.icn3d.structures[structureNum] === undefined) me.icn3d.structures[structureNum] = [];
    me.icn3d.structures[structureNum].push(chainNum);

    // update bonds info
    if(type !== 'mmcifid') {
    //for (var i in me.icn3d.atoms) {
    for (var i in atoms) {
        var currSerial = atomid2serial[i];

        var bondLength = (me.icn3d.atoms[currSerial].bonds === undefined) ? 0 : me.icn3d.atoms[currSerial].bonds.length;

        for(var j = 0; j < bondLength; ++j) {
            me.icn3d.atoms[currSerial].bonds[j] = atomid2serial[me.icn3d.atoms[currSerial].bonds[j]];
        }
    }
    }

    // remove the reference
    data.atoms = {};

    //me.icn3d.cnt = (alignType === undefined || alignType === 'target') ? serial : serial - me.lastTargetSerial;
    me.icn3d.cnt = serial;

    if(me.icn3d.cnt > me.icn3d.maxatomcnt || (me.icn3d.biomtMatrices !== undefined && me.icn3d.biomtMatrices.length * me.icn3d.cnt > 10 * me.icn3d.maxatomcnt) ) {
        me.opts['proteins'] = 'c alpha trace'; //ribbon, strand, cylinder and plate, schematic, c alpha trace, b factor tube, lines, stick, ball and stick, sphere, nothing
        me.opts['nucleotides'] = 'o3 trace'; //nucleotide cartoon, o3 trace, schematic, lines, stick,
    }

    me.icn3d.maxD = me.icn3d.pmax.distanceTo(me.icn3d.pmin);
    me.icn3d.center = me.icn3d.psum.multiplyScalar(1.0 / me.icn3d.cnt);
    if (me.icn3d.maxD < 5) me.icn3d.maxD = 5;

    // set up disulfide bonds
    if(type === 'mmdbid') {
        var disulfideArray = data.disulfides;

        if(disulfideArray !== undefined) {
            for(var i = 0, il = disulfideArray.length; i < il; ++i) {
                var serial1 = disulfideArray[i][0].ca;
                var serial2 = disulfideArray[i][1].ca;

                var atom1 = me.icn3d.atoms[serial1];
                var atom2 = me.icn3d.atoms[serial2];

                var chain1 = atom1.chain;
                var chain2 = atom2.chain;

                var resid1 = atom1.structure + '_' + chain1 + '_' + atom1.resi;
                var resid2 = atom2.structure + '_' + chain2 + '_' + atom2.resi;

                if(me.icn3d.ssbondpnts[atom1.structure] === undefined) me.icn3d.ssbondpnts[atom1.structure] = [];

                me.icn3d.ssbondpnts[atom1.structure].push(resid1);
                me.icn3d.ssbondpnts[atom1.structure].push(resid2);
            }
        }
    }
    else if(type === 'mmcifid') {
        var disulfideArray = data.disulfides;

        if(disulfideArray !== undefined) {
            if(me.icn3d.ssbondpnts[id] === undefined) me.icn3d.ssbondpnts[id] = [];

            for(var i = 0, il = disulfideArray.length; i < il; ++i) {
                var resid1 = disulfideArray[i][0];
                var resid2 = disulfideArray[i][1];

                me.icn3d.ssbondpnts[id].push(resid1);
                me.icn3d.ssbondpnts[id].push(resid2);
            }

            // copy disulfide bonds
            var structureArray = Object.keys(me.icn3d.structures);
            for(var s = 0, sl = structureArray.length; s < sl; ++s) {
                var structure = structureArray[s];

                if(structure == id) continue;

                if(me.icn3d.ssbondpnts[structure] === undefined) me.icn3d.ssbondpnts[structure] = [];

                for(var j = 0, jl = me.icn3d.ssbondpnts[id].length; j < jl; ++j) {
                    var ori_resid = me.icn3d.ssbondpnts[id][j];
                    var pos = ori_resid.indexOf('_');
                    var resid = structure + ori_resid.substr(pos);

                    me.icn3d.ssbondpnts[structure].push(resid);
                }
            }
        }
    }
    else if(type === 'align') { // calculate disulfide bonds
        // get all Cys residues
        var structure2cys_resid = {};
        for(var chainid in chainid2seq) {
            if(chainid2kind[chainid] == 'protein') {
                var seq = chainid2seq[chainid];
                var structure = chainid.substr(0, chainid.indexOf('_'));

                for(var i = 0, il = seq.length; i < il; ++i) {
                    // each seq[i] = [1,"1","V","VAL NH3+"],
                    if(seq[i][2] == 'C') {
                        if(structure2cys_resid[structure] == undefined) structure2cys_resid[structure] = [];
                        structure2cys_resid[structure].push(chainid + '_' + seq[i][0]);
                    }
                }
            }
        }

        me.icn3d.setSsbond(structure2cys_resid);
    }

    if(type === 'mmcifid') {
        me.transformToOpmOri(id);
    }
    else if(type === 'mmdbid') {
        me.transformToOpmOri(id);
    }

    // set up sequence alignment
    // display the structure right away. load the mns and sequences later
//        setTimeout(function(){
    if(type === 'align' && seqalign !== undefined && me.bFullUi) {
        me.setSeqAlign(seqalign, data.alignedStructures);
    } // if(align
    else if(type === 'mmdbid' && alignType === 'query' && me.bFullUi && me.q_rotation !== undefined) {
        me.setSeqAlignChain();
    }

    if(type === 'mmdbid' && (alignType === 'target' || alignType === 'query') && me.q_rotation === undefined) {
        if(alignType === 'target' || alignType === 'query') {
            for(var i in atoms) {
                var atom = atoms[i];
                atom.coord.x -= me.icn3d.center.x;
                atom.coord.y -= me.icn3d.center.y;
                atom.coord.z -= me.icn3d.center.z;
            }
        }

        if(alignType === 'target') {
            me.icn3d.maxD1 = me.icn3d.maxD;
            me.icn3d.center1 = me.icn3d.center;
        }
        else if(alignType === 'query') {
            me.icn3d.maxD2 = me.icn3d.maxD;
            me.icn3d.center2 = me.icn3d.center;

            if(me.icn3d.maxD2 < me.icn3d.maxD1) me.icn3d.maxD = me.icn3d.maxD1;
            me.icn3d.center = new THREE.Vector3(0,0,0);
        }
    }

    me.icn3d.oriMaxD = me.icn3d.maxD;
    me.icn3d.oriCenter = me.icn3d.center.clone();

    me.showTitle();

    data = {};
};
