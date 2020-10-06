/**
 * @author Jiyao Wang <wangjiy@ncbi.nlm.nih.gov> / https://github.com/ncbi/icn3d
 */

iCn3DUI.prototype.update2DdgmContent = function () { var me = this, ic = me.icn3d; "use strict";
   // update 2D diagram to show just the displayed parts
   var html2ddgm = '';
   if(me.cfg.mmdbid !== undefined || me.cfg.gi !== undefined) {
      html2ddgm += me.draw2Ddgm(me.interactionData, me.inputid, undefined, true);
      html2ddgm += me.set2DdgmNote();

      $("#" + me.pre + "dl_2ddgm").html(html2ddgm);
   }
   else if(me.cfg.align !== undefined || me.cfg.chainalign !== undefined || me.bRealign) {
      html2ddgm += me.draw2Ddgm(me.interactionData1, me.mmdbidArray[0].toUpperCase(), 0, true);
      if(me.mmdbid_q !== undefined && me.mmdbid_q === me.mmdbid_t) {
          html2ddgm += me.draw2Ddgm(me.interactionData2, me.mmdbidArray[0].toUpperCase(), 1, true);
      }
      else {
          html2ddgm += me.draw2Ddgm(me.interactionData2, me.mmdbidArray[1].toUpperCase(), 1, true);
      }
      html2ddgm += me.set2DdgmNote(true);

      $("#" + me.pre + "dl_2ddgm").html(html2ddgm);
   }
};

iCn3DUI.prototype.changeSeqColor = function(residueArray) { var me = this, ic = me.icn3d; "use strict";
   for(var i = 0, il = residueArray.length; i < il; ++i) {
       var pickedResidue = residueArray[i];
       //[id$= is expensive
       //if($("[id$=" + me.pre + pickedResidue + "]").length !== 0) {
         var atom = me.icn3d.getFirstCalphaAtomObj(me.icn3d.residues[pickedResidue]);
         var colorStr = (atom.color === undefined || atom.color.getHexString().toUpperCase() === 'FFFFFF') ? 'DDDDDD' : atom.color.getHexString();
         var color = (atom.color !== undefined) ? colorStr : "CCCCCC";
         // annotations will have their own color, only the chain will have the changed color
         $("[id=giseq_" + me.pre + pickedResidue + "]").attr('style', 'color:#' + color);
         $("[id=align_" + me.pre + pickedResidue + "]").attr('style', 'color:#' + color);
         if(me.cfg.align !== undefined || me.cfg.chainalign !== undefined || me.bRealign) $("[id=align_" + me.pre + pickedResidue + "]").attr('style', 'color:#' + color);
       //}
   }
};

iCn3DUI.prototype.removeHlAll = function() { var me = this, ic = me.icn3d; "use strict";
       me.removeHlObjects();
       me.removeHlSeq();
       me.removeHl2D();
       me.removeHlMenus();
};

iCn3DUI.prototype.removeHlObjects = function() { var me = this, ic = me.icn3d; "use strict";
       me.icn3d.removeHlObjects();
};

// remove highlight in sequence
iCn3DUI.prototype.removeHlSeq = function() { var me = this, ic = me.icn3d; "use strict";
//       me.removeSeqChainBkgd();
       me.removeSeqResidueBkgd();
};

// remove highlight in 2D window
iCn3DUI.prototype.removeHl2D = function() { var me = this, ic = me.icn3d; "use strict";
      // clear nodes in 2d dgm
      $("#" + me.pre + "dl_2ddgm rect").attr('stroke', '#000000');
      $("#" + me.pre + "dl_2ddgm circle").attr('stroke', '#000000');
      $("#" + me.pre + "dl_2ddgm polygon").attr('stroke', '#000000');

      $("#" + me.pre + "dl_2ddgm svg line").attr('stroke', '#000000');

      $("#" + me.pre + "dl_2ddgm rect").attr('stroke-width', 1);
      $("#" + me.pre + "dl_2ddgm circle").attr('stroke-width', 1);
      $("#" + me.pre + "dl_2ddgm polygon").attr('stroke-width', 1);

      $("#" + me.pre + "dl_2ddgm line").attr('stroke-width', 1);
};

// remove highlight in the menu of defined sets
iCn3DUI.prototype.removeHlMenus = function() { var me = this, ic = me.icn3d; "use strict";
    $("#" + me.pre + "atomsCustom").val("");
    $("#" + me.pre + "atomsCustom")[0].blur();
};

iCn3DUI.prototype.updateHlAll = function(commandnameArray, bSetMenu, bUnion, bForceHighlight) { var me = this, ic = me.icn3d; "use strict";
       // update the previously highlisghted atoms for switching between all and selection
       me.icn3d.prevHighlightAtoms = me.icn3d.cloneHash(me.icn3d.hAtoms);

       me.updateHlObjects(bForceHighlight);

       if(commandnameArray !== undefined) {
           me.updateHlSeqInChain(commandnameArray, bUnion);
       }
       else {
           me.updateHlSeq(undefined, undefined, bUnion);
       }

       me.updateHl2D();
       if(bSetMenu === undefined || bSetMenu) me.updateHlMenus(commandnameArray);

       //me.showAnnoSelectedChains();
};

iCn3DUI.prototype.updateHlObjects = function(bForceHighlight) { var me = this, ic = me.icn3d; "use strict";
       me.icn3d.removeHlObjects();

       if((me.icn3d.hAtoms !== undefined && Object.keys(me.icn3d.hAtoms).length < Object.keys(me.icn3d.atoms).length) || bForceHighlight) {
          me.icn3d.addHlObjects();
          me.setMode('selection');
       }
};

// update highlight in sequence, slow if sequence is long
iCn3DUI.prototype.updateHlSeq = function(bShowHighlight, residueHash, bUnion) { var me = this, ic = me.icn3d; "use strict";
       if(bUnion === undefined || !bUnion) {
           me.removeHlSeq();
       }

       if(residueHash === undefined) residueHash = me.icn3d.getResiduesFromCalphaAtoms(me.icn3d.hAtoms);

       if(Object.keys(me.icn3d.hAtoms).length < Object.keys(me.icn3d.atoms).length) me.hlSeq(Object.keys(residueHash));
       me.changeSeqColor(Object.keys(residueHash));
};

iCn3DUI.prototype.updateHlSeqInChain = function(commandnameArray, bUnion) { var me = this, ic = me.icn3d; "use strict";
       if(bUnion === undefined || !bUnion) {
           me.removeHlSeq();
       }
       //if(residueHash === undefined) residueHash = me.icn3d.getResiduesFromCalphaAtoms(me.icn3d.hAtoms);

       if(Object.keys(me.icn3d.hAtoms).length == Object.keys(me.icn3d.atoms).length) return;

       //me.hlSeq(Object.keys(residueHash));
       // speed up with chain highlight
       for(var i = 0, il = commandnameArray.length; i < il; ++i) {
           var commandname = commandnameArray[i];
           if(Object.keys(me.icn3d.chains).indexOf(commandname) !== -1) {
               me.hlSeqInChain(commandname);
           }
           else {
               var residueArray = [];

               if(me.icn3d.defNames2Residues[commandname] !== undefined && me.icn3d.defNames2Residues[commandname].length > 0) {
                   residueArray = me.icn3d.defNames2Residues[commandname];
               }

               var residueHash = {};
               if(me.icn3d.defNames2Atoms[commandname] !== undefined && me.icn3d.defNames2Atoms[commandname].length > 0) {
                   for(var j = 0, jl = me.icn3d.defNames2Atoms[commandname].length; j < jl; ++j) {
                       var serial = me.icn3d.defNames2Atoms[commandname][j];
                       var atom = me.icn3d.atoms[serial];
                       var resid = atom.structure + '_' + atom.chain + '_' + atom.resi;

                       residueHash[resid] = 1;
                   }

                   residueArray = residueArray.concat(Object.keys(residueHash));
               }

               me.hlSeq(residueArray);
           }
       }

       //me.changeSeqColor(Object.keys(residueHash));
};

// update highlight in 2D window
iCn3DUI.prototype.updateHl2D = function(chainArray2d) { var me = this, ic = me.icn3d; "use strict";
  me.removeHl2D();

  if(Object.keys(me.icn3d.hAtoms).length == Object.keys(me.icn3d.atoms).length) return;

  if(chainArray2d === undefined) {
      var chainHash = me.icn3d.getChainsFromAtoms(me.icn3d.hAtoms);
      chainArray2d = Object.keys(chainHash);
  }

  if(chainArray2d !== undefined) {
      for(var i = 0, il = chainArray2d.length; i < il; ++i) {
          var hlatoms = me.icn3d.intHash(me.icn3d.chains[chainArray2d[i]], me.icn3d.hAtoms);
          var ratio = 1.0 * Object.keys(hlatoms).length / Object.keys(me.icn3d.chains[chainArray2d[i]]).length;

          var firstAtom = me.icn3d.getFirstCalphaAtomObj(hlatoms);
          if(me.icn3d.alnChains[chainArray2d[i]] !== undefined) {
                var alignedAtoms = me.icn3d.intHash(me.icn3d.alnChains[chainArray2d[i]], hlatoms);
                if(Object.keys(alignedAtoms).length > 0) firstAtom = me.icn3d.getFirstCalphaAtomObj(alignedAtoms);
            }
          var color = (firstAtom !== undefined && firstAtom.color !== undefined) ? '#' + firstAtom.color.getHexString() : '#FFFFFF';

          var target = $("#" + me.pre + "dl_2ddgm g[chainid=" + chainArray2d[i] + "] rect[class='icn3d-hlnode']");
          var base = $("#" + me.pre + "dl_2ddgm g[chainid=" + chainArray2d[i] + "] rect[class='icn3d-basenode']");
          if(target !== undefined) {
              me.highlightNode('rect', target, base, ratio);
              $(target).attr('fill', color);
          }

          target = $("#" + me.pre + "dl_2ddgm g[chainid=" + chainArray2d[i] + "] circle[class='icn3d-hlnode']");
          base = $("#" + me.pre + "dl_2ddgm g[chainid=" + chainArray2d[i] + "] circle[class='icn3d-basenode']");
          if(target !== undefined) {
                me.highlightNode('circle', target, base, ratio);
                $(target).attr('fill', color);
          }

          target = $("#" + me.pre + "dl_2ddgm g[chainid=" + chainArray2d[i] + "] polygon[class='icn3d-hlnode']");
          base = $("#" + me.pre + "dl_2ddgm g[chainid=" + chainArray2d[i] + "] polygon[class='icn3d-basenode']");

          if(target !== undefined) {
              me.highlightNode('polygon', target, base, ratio);
              $(target).attr('fill', color);
          }
      }
  }

  if(me.lineArray2d !== undefined) {
      for(var i = 0, il = me.lineArray2d.length; i < il; i += 2) {
          $("#" + me.pre + "dl_2ddgm g[chainid1=" + me.lineArray2d[i] + "][chainid2=" + me.lineArray2d[i + 1] + "] line").attr('stroke', me.ORANGE);
      }
  }

  // update the previously highlisghted atoms for switching between all and selection
  me.icn3d.prevHighlightAtoms = me.icn3d.cloneHash(me.icn3d.hAtoms);

  me.setMode('selection');
};

// update highlight in the menu of defined sets
iCn3DUI.prototype.updateHlMenus = function(commandnameArray) { var me = this, ic = me.icn3d; "use strict";
    if(commandnameArray === undefined) commandnameArray = [];

    var definedAtomsHtml = me.setAtomMenu(commandnameArray);

    if($("#" + me.pre + "atomsCustom").length) {
        $("#" + me.pre + "atomsCustom").html(definedAtomsHtml);
        $("#" + me.pre + "atomsCustom")[0].blur();
    }
};

iCn3DUI.prototype.setAtomMenu = function (commandnameArray) { var me = this, ic = me.icn3d; "use strict";
  var html = "";

  var nameArray1 = (me.icn3d.defNames2Residues !== undefined) ? Object.keys(me.icn3d.defNames2Residues) : [];
  var nameArray2 = (me.icn3d.defNames2Atoms !== undefined) ? Object.keys(me.icn3d.defNames2Atoms) : [];

  var nameArrayTmp = nameArray1.concat(nameArray2).sort();

  var nameArray = [];
  $.each(nameArrayTmp, function(i, el){
       if($.inArray(el, nameArray) === -1) nameArray.push(el);
  });

  //for(var i in me.icn3d.defNames2Atoms) {
  for(var i = 0, il = nameArray.length; i < il; ++i) {
      var name = nameArray[i];

      var atom, atomHash;
      if(me.icn3d.defNames2Atoms !== undefined && me.icn3d.defNames2Atoms.hasOwnProperty(name)) {
          var atomArray = me.icn3d.defNames2Atoms[name];

          if(atomArray.length > 0) atom = me.icn3d.atoms[atomArray[0]];
      }
      else if(me.icn3d.defNames2Residues !== undefined && me.icn3d.defNames2Residues.hasOwnProperty(name)) {
          var residueArray = me.icn3d.defNames2Residues[name];
          if(residueArray.length > 0) {
              atomHash = me.icn3d.residues[residueArray[0]]
              if(atomHash) {
                  atom = me.icn3d.atoms[Object.keys(atomHash)[0]];
              }
          }
      }

      var colorStr = (atom === undefined || atom.color === undefined || atom.color.getHexString().toUpperCase() === 'FFFFFF') ? 'DDDDDD' : atom.color.getHexString();
      var color = (atom !== undefined && atom.color !== undefined) ? colorStr : '000000';

      if(commandnameArray.indexOf(name) != -1) {
        html += "<option value='" + name + "' style='color:#" + color + "' selected='selected'>" + name + "</option>";
      }
      else {
        html += "<option value='" + name + "' style='color:#" + color + "'>" + name + "</option>";
      }
  }

  return html;
};

iCn3DUI.prototype.setPredefinedInMenu = function() { var me = this, ic = me.icn3d; "use strict";
      // predefined sets: all chains
      me.setChainsInMenu();

      // predefined sets: proteins,nucleotides, chemicals
      me.setProtNuclLigInMenu();

      // show 3d domains for mmdbid
      if(me.cfg.mmdbid !== undefined || me.cfg.gi !== undefined || me.cfg.chainalign !== undefined) {
          for(var tddomainName in me.icn3d.tddomains) {
              me.selectResidueList(me.icn3d.tddomains[tddomainName], tddomainName, tddomainName, false, false);
          }
      }

      if((me.cfg.align !== undefined || me.cfg.chainalign !== undefined) && me.bFullUi) {
        me.selectResidueList(me.consHash1, me.conservedName1, me.conservedName1, false, false);
        me.selectResidueList(me.consHash2, me.conservedName2, me.conservedName2, false, false);

        me.selectResidueList(me.nconsHash1, me.nonConservedName1, me.nonConservedName1, false, false);
        me.selectResidueList(me.nconsHash2, me.nonConservedName2, me.nonConservedName2, false, false);

        me.selectResidueList(me.nalignHash1, me.notAlignedName1, me.notAlignedName1, false, false);
        me.selectResidueList(me.nalignHash2, me.notAlignedName2, me.notAlignedName2, false, false);

        // for alignment, show aligned residues, chemicals, and ions
        var dAtoms = {};
        for(var alignChain in me.icn3d.alnChains) {
            dAtoms = me.icn3d.unionHash(dAtoms, me.icn3d.alnChains[alignChain]);
        }

        var residuesHash = {}, chains = {};
        for(var i in dAtoms) {
            var atom = me.icn3d.atoms[i];

            var chainid = atom.structure + '_' + atom.chain;
            var resid = chainid + '_' + atom.resi;
            residuesHash[resid] = 1;
            chains[chainid] = 1;
        }

        var commandname = 'protein_aligned';
        var commanddescr = 'aligned protein and nucleotides';
        var select = "select " + me.residueids2spec(Object.keys(residuesHash));

        //me.addCustomSelection(Object.keys(residuesHash), Object.keys(dAtoms), commandname, commanddescr, select, true);
        me.addCustomSelection(Object.keys(residuesHash), commandname, commanddescr, select, true);
      }
};

iCn3DUI.prototype.hlSeq = function(residueArray) { var me = this, ic = me.icn3d; "use strict";
   // update annotation windows and alignment sequences
   var chainHash = {};
   for(var i = 0, il = residueArray.length; i < il; ++i) {
       var pickedResidue = residueArray[i];
       //[id$= is expensive to search id ending with
       //var resElem = $("[id$=" + me.pre + pickedResidue + "]");
       var resElem = $("[id=giseq_" + me.pre + pickedResidue + "]");
       if(resElem.length !== 0) {
         resElem.addClass('icn3d-highlightSeq');
       }

       resElem = $("[id=align_" + me.pre + pickedResidue + "]");
       if(resElem.length !== 0) {
         resElem.addClass('icn3d-highlightSeq');
       }

       var pos = pickedResidue.lastIndexOf('_');
       var chainid = pickedResidue.substr(0, pos);

       chainHash[chainid] = 1;
   }

   for(var chainid in chainHash) {
       if($("#giseq_summary_" + me.pre + chainid).length !== 0) {
         $("#giseq_summary_" + me.pre + chainid).addClass('icn3d-highlightSeqBox');
       }
   }
};

iCn3DUI.prototype.hlSeqInChain = function(chainid) { var me = this, ic = me.icn3d; "use strict";
   // update annotation windows and alignment sequences
   for(var i = 0, il = me.icn3d.chainsSeq[chainid].length; i < il; ++i) {
       var resi = me.icn3d.chainsSeq[chainid][i].resi;
       var pickedResidue = chainid + '_' + resi;

       //if($("[id$=" + me.pre + pickedResidue + "]").length !== 0) {
       //  $("[id$=" + me.pre + pickedResidue + "]").addClass('icn3d-highlightSeq');
       //}
       // too expensive to highlight all annotations
       if($("#giseq_" + me.pre + pickedResidue).length !== 0) {
         $("#giseq_" + me.pre + pickedResidue).addClass('icn3d-highlightSeq');
       }
       if($("#align_" + me.pre + pickedResidue).length !== 0) {
         $("#align_" + me.pre + pickedResidue).addClass('icn3d-highlightSeq');
       }
   }

   if($("#giseq_summary_" + me.pre + chainid).length !== 0) {
     $("#giseq_summary_" + me.pre + chainid).addClass('icn3d-highlightSeqBox');
   }
};

iCn3DUI.prototype.toggleHighlight = function() { var me = this, ic = me.icn3d; "use strict";
    //me.setLogCmd("toggle highlight", true);

    if(me.icn3d.prevHighlightObjects.length > 0 || me.icn3d.prevHighlightObjects_ghost.length > 0) { // remove
        me.clearHighlight();
        me.icn3d.bShowHighlight = false;
    }
    else { // add
        me.showHighlight();
        me.icn3d.bShowHighlight = true;
    }

    //me.setLogCmd("toggle highlight", true);
};

iCn3DUI.prototype.clearHighlight = function() { var me = this, ic = me.icn3d; "use strict";
    me.icn3d.labels['picking']=[];
    me.icn3d.draw();

    me.icn3d.removeHlObjects();
    me.removeHl2D();
    if(me.icn3d.bRender) me.icn3d.render();

    me.removeSeqChainBkgd();
    me.removeSeqResidueBkgd();

    me.bSelectResidue = false;
};

iCn3DUI.prototype.showHighlight = function() { var me = this, ic = me.icn3d; "use strict";
    me.icn3d.addHlObjects();
    me.updateHlAll();
    //me.bSelectResidue = true;
};

iCn3DUI.prototype.highlightChains = function(chainArray) { var me = this, ic = me.icn3d; "use strict";
    me.icn3d.removeHlObjects();
    me.removeHl2D();

    me.icn3d.addHlObjects();
    me.updateHl2D(chainArray);

    var residueHash = {};
    for(var c = 0, cl = chainArray.length; c < cl; ++c) {
        var chainid = chainArray[c];
        for(var i in me.icn3d.chainsSeq[chainid]) { // get residue number
            var resObj = me.icn3d.chainsSeq[chainid][i];
            var residueid = chainid + "_" + resObj.resi;

            if(resObj.name !== '' && resObj.name !== '-') {
              residueHash[residueid] = 1;
            }
        }
    }

    me.hlSeq(Object.keys(residueHash));
};

