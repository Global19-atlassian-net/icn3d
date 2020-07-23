/**
 * @author Jiyao Wang <wangjiy@ncbi.nlm.nih.gov> / https://github.com/ncbi/icn3d
 */

// from the 2016 NCBI hackathon in Orlando: https://github.com/NCBI-Hackathons/iCN3D-MMTF
// Contributors: Jiyao Wang, Alexander Rose, Peter Rose
// requires the library mmtf.js
iCn3DUI.prototype.downloadMmtf = function (mmtfid) { var me = this; //"use strict";
    document.title = mmtfid.toUpperCase() + ' (MMTF) in iCn3D';
    me.icn3d.bCid = undefined;

    //https://mmtf.rcsb.org/v1.0/reduced/1TUP
    //https://mmtf.rcsb.org/v1.0/full/1TUP

    var url1, url2;

    url1 = "https://mmtf.rcsb.org/v1.0/reduced/" + mmtfid.toUpperCase();
    url2 = "https://mmtf.rcsb.org/v1.0/full/" + mmtfid.toUpperCase();

    var oReq1 = new XMLHttpRequest();
    oReq1.open("GET", url1, true);
    oReq1.responseType = "arraybuffer";

    oReq1.onload = function (oEvent) {
      var arrayBuffer = oReq1.response; // Note: not oReq.responseText
      if (arrayBuffer) {
        var byteArray = new Uint8Array(arrayBuffer);
        var mmtfData = MMTF.decode( byteArray );

        if(mmtfData.numAtoms * 10 > me.icn3d.maxatomcnt) {
            var bFull = false;
            me.deferredOpm = $.Deferred(function() {
                if(Object.keys(mmtfData).length == 0) {
                    alert('This PDB structure is not found at RCSB...');
                    return me.deferredOpm.promise();
                }
                me.loadOpmData(mmtfData, mmtfid, bFull, 'mmtf');
            });

            return me.deferredOpm.promise();
        }
        else {
            mmtfData = null;

            var oReq2 = new XMLHttpRequest();
            oReq2.open("GET", url2, true);
            oReq2.responseType = "arraybuffer";

            oReq2.onload = function (oEvent) {
              var arrayBuffer = oReq2.response; // Note: not oReq.responseText
              if (arrayBuffer) {
                var byteArray = new Uint8Array(arrayBuffer);
                var mmtfData2 = MMTF.decode( byteArray );

                var bFull = true;
                me.deferredOpm = $.Deferred(function() {
                    if(Object.keys(mmtfData2).length == 0) {
                        alert('This PDB structure is not found at RCSB...');
                        return me.deferredOpm.promise();
                    }

                    me.loadOpmData(mmtfData2, mmtfid, bFull, 'mmtf');
                });

                return me.deferredOpm.promise();
              }
            };

            oReq2.send(null);
        }
      }
    };

    oReq1.send(null);

/*
    // MMTF.fetch had problem at NCBI servers on June 18, 2020

    MMTF.fetchReduced(
        mmtfid,
        // onLoad callback
        function( mmtfData ){
            if(mmtfData.numAtoms * 10 > me.icn3d.maxatomcnt) {
                var bFull = false;
                //me.parseMmtfData(mmtfData, bFull);
                me.deferredOpm = $.Deferred(function() {
                    if(Object.keys(mmtfData).length == 0) {
                        alert('This PDB structure is not found at RCSB...');
                        return me.deferredOpm.promise();
                    }
                    //me.loadMmtfOpmData(mmtfData, mmtfid, bFull);
                    me.loadOpmData(mmtfData, mmtfid, bFull, 'mmtf');
                });

                return me.deferredOpm.promise();
            }
            else {
                mmtfData = null;

                MMTF.fetch(
                    mmtfid,
                    // onLoad callback
                    function( mmtfData2 ){
                        var bFull = true;
                        //me.parseMmtfData(mmtfData2, bFull);
                        me.deferredOpm = $.Deferred(function() {
                            if(Object.keys(mmtfData2).length == 0) {
                                alert('This PDB structure is not found at RCSB...');
                                return me.deferredOpm.promise();
                            }

                            //me.loadMmtfOpmData(mmtfData2, mmtfid, bFull);
                            me.loadOpmData(mmtfData2, mmtfid, bFull, 'mmtf');
                        });

                        return me.deferredOpm.promise();
                    },
                    // onError callback
                    function( error ){
                        //alert('This PDB structure is not found at RCSB...');
                        //console.error( error )
                    }
                );
            }
        },
        // onError callback
        function( error ){
            //alert('This PDB structure is not found at RCSB...');
            //console.error( error )
        }
    );
*/
};

iCn3DUI.prototype.parseMmtfData = function (mmtfData, mmtfid, bFull) { var me = this; //"use strict";
    var cnt = mmtfData.numAtoms;

    me.icn3d.init();

    var pmin = new THREE.Vector3( 9999, 9999, 9999);
    var pmax = new THREE.Vector3(-9999,-9999,-9999);
    var psum = new THREE.Vector3();

    var id = mmtfData.structureId;

    me.icn3d.molTitle = mmtfData.title;

    // bioAsembly
    if(mmtfData.bioAssemblyList !== undefined && mmtfData.bioAssemblyList[0]!== undefined && mmtfData.bioAssemblyList[0].transformList.length > 1) {
        me.icn3d.biomtMatrices = [];

        for(var i = 0, il = mmtfData.bioAssemblyList[0].transformList.length; i < il; ++i) {
            //var biomt = new THREE.Matrix4().identity();

            //for(var j = 0, jl = mmtfData.bioAssemblyList[0].transformList[i].matrix.length; j < jl; ++j) {
                //biomt.elements[j] = mmtfData.bioAssemblyList[0].transformList[i].matrix[j];
            //}

            var biomt = new THREE.Matrix4().fromArray(mmtfData.bioAssemblyList[0].transformList[i].matrix).transpose();

            me.icn3d.biomtMatrices.push(biomt);
        }
    }

    if(me.icn3d.biomtMatrices !== undefined && me.icn3d.biomtMatrices.length > 1) {
        $("#" + me.pre + "assemblyWrapper").show();

        me.icn3d.asuCnt = me.icn3d.biomtMatrices.length;
    }
    else {
        $("#" + me.pre + "assemblyWrapper").hide();
    }

    var oriindex2serial = {};

    // save SG atoms in CYS residues
    var SGAtomSerialArray = [];

    var prevSS = 'coil';
    var prevChain = '';
    var prevResi = 0;

    var serial = 0;

    var structure, chain, resn, resi, ss, ssbegin, ssend;
    var het, bProtein, bNucleotide;
    var elem, atomName, coord, b, alt;
    var CSerial, prevCSerial, OSerial, prevOSerial;

    var bModifyResi = false;

    var callbackDict = {
        onModel: function( modelData ){
            structure = (modelData.modelIndex === 0) ? id : id + (modelData.modelIndex + 1).toString();
        },
        onChain: function( chainData ){
            bModifyResi = false;

            chain = chainData.chainName; // or chainData.chainId
            var chainid = structure + '_' + chain;

            if(me.icn3d.structures[structure] === undefined) me.icn3d.structures[structure] = [];
            me.icn3d.structures[structure].push(chainid);

/*
            if(me.icn3d.chainsAnTitle[chainid] === undefined ) me.icn3d.chainsAnTitle[chainid] = [];
            if(me.icn3d.chainsAnTitle[chainid][0] === undefined ) me.icn3d.chainsAnTitle[chainid][0] = [];
            if(me.icn3d.chainsAnTitle[chainid][1] === undefined ) me.icn3d.chainsAnTitle[chainid][1] = [];
            me.icn3d.chainsAnTitle[chainid][0].push('');
            me.icn3d.chainsAnTitle[chainid][1].push('SS');
*/
        },
        onGroup: function( groupData ){
            resn = groupData.groupName;
            resi = groupData.groupId;

            //if(resi == prevResi || bModifyResi) {
            //    bModifyResi = true;
            //    resi = prevResi + 1; // for residue insertion code
            //}

            var resid = structure + '_' + chain + '_' + resi;

            if(groupData.secStruct === 0 || groupData.secStruct === 2 || groupData.secStruct === 4) {
                ss = 'helix';
            }
            else if(groupData.secStruct === 3) {
                ss = 'sheet';
            }
            else if(groupData.secStruct === -1) {
                ss = 'other';
            }
            else {
                ss = 'coil';
            }

            // no residue can be both ssbegin and ssend in DSSP calculated secondary structures
            var bSetPrevSsend = false;

            if(chain !== prevChain) {
                prevCSerial = undefined;
                prevOSerial = undefined;

                // new chain
                if(ss !== 'coil' && ss !== 'other') {
                    ssbegin = true;
                    ssend = false;
                }
                else {
                    ssbegin = false;
                    ssend = false;
                }

                // set up the end of previous chain
                if(prevSS !== 'coil' && prevSS !== 'other') {
                    var prevResid = structure + '_' + prevChain + '_' + prevResi.toString();

                    for(var i in me.icn3d.residues[prevResid]) {
                        me.icn3d.atoms[i].ssbegin = false;
                        me.icn3d.atoms[i].ssend = true;
                    }
                }
            }
            else {
                prevCSerial = CSerial;
                prevOSerial = OSerial;

                if(ss !== prevSS) {
                    if(prevSS === 'coil' || prevSS === 'other') {
                        ssbegin = true;
                        ssend = false;
                    }
                    else if(ss === 'coil' || ss === 'other') {
                        bSetPrevSsend = true;
                        ssbegin = false;
                        ssend = false;
                    }
                    else if( (prevSS === 'sheet' && ss === 'helix') || (prevSS === 'helix' && ss === 'sheet')) {
                        bSetPrevSsend = true;
                        ssbegin = true;
                        ssend = false;
                    }
                }
                else {
                        ssbegin = false;
                        ssend = false;
                }
            }

            if(bSetPrevSsend) {
                var prevResid = structure + '_' + chain + '_' + (resi - 1).toString();
                for(var i in me.icn3d.residues[prevResid]) {
                    me.icn3d.atoms[i].ssbegin = false;
                    me.icn3d.atoms[i].ssend = true;
                }
            }

            prevSS = ss;
            prevChain = chain;
            prevResi = resi;

            het = false;
            bProtein = false;
            bNucleotide = false;
            if(groupData.chemCompType.toLowerCase() === 'non-polymer' || groupData.chemCompType.toLowerCase() === 'other' || groupData.chemCompType.toLowerCase().indexOf('saccharide') !== -1) {
                het = true;
            }
            else if(groupData.chemCompType.toLowerCase().indexOf('peptide') !== -1) {
                bProtein = true;
            }
            else if(groupData.chemCompType.toLowerCase().indexOf('dna') !== -1 || groupData.chemCompType.toLowerCase().indexOf('rna') !== -1) {
                bNucleotide = true;
            }
            else {
                bProtein = true;
            }

              // add sequence information
              var chainid = structure + '_' + chain;

              var resObject = {};
              resObject.resi = resi;
              resObject.name = me.icn3d.residueName2Abbr(resn);

              me.icn3d.residueId2Name[resid] = resObject.name;

              var numberStr = '';
              if(resObject.resi % 10 === 0) numberStr = resObject.resi.toString();

              var secondaries = '-';
              if(ss === 'helix') {
                  secondaries = 'H';
              }
              else if(ss === 'sheet') {
                  secondaries = 'E';
              }
              else if(ss === 'coil') {
                  secondaries = 'c';
              }
              else if(ss === 'other') {
                  secondaries = 'o';
              }

              if(me.icn3d.chainsSeq[chainid] === undefined) me.icn3d.chainsSeq[chainid] = [];
              if(me.bFullUi) me.icn3d.chainsSeq[chainid].push(resObject);

              me.icn3d.secondaries[resid] = secondaries;
        },
        onAtom: function( atomData ){
            elem = atomData.element;
            atomName = atomData.atomName;
            coord = new THREE.Vector3(atomData.xCoord, atomData.yCoord, atomData.zCoord);
            b = atomData.bFactor;

            alt = atomData.altLoc;
            if(atomData.altLoc === '\u0000') { // a temp value, should be ''
                alt = '';
            }

            // skip the atoms where alt is not '' or 'A'
            if(alt === '' || alt === 'A') {
                ++serial;

                if(atomName === 'SG') SGAtomSerialArray.push(serial);

                oriindex2serial[atomData.atomIndex] = serial;

                var atomDetails = {
                    het: het, // optional, used to determine chemicals, water, ions, etc
                    serial: serial,         // required, unique atom id
                    name: atomName,             // required, atom name
                    alt: alt,               // optional, some alternative coordinates
                    resn: resn,             // optional, used to determine protein or nucleotide
                    structure: structure,   // optional, used to identify structure
                    chain: chain,           // optional, used to identify chain
                    resi: resi,             // optional, used to identify residue ID
                    //insc: line.substr(26, 1),
                    coord: coord,           // required, used to draw 3D shape
                    b: b,         // optional, used to draw B-factor tube
                    elem: elem,             // optional, used to determine hydrogen bond
                    bonds: [],              // required, used to connect atoms
                    bondOrder: [],
                    ss: ss,             // optional, used to show secondary structures
                    ssbegin: ssbegin,         // optional, used to show the beginning of secondary structures
                    ssend: ssend            // optional, used to show the end of secondary structures
                };

                if(!atomDetails.het && atomDetails.name === 'C') {
                    CSerial = serial;
                }
                if(!atomDetails.het && atomDetails.name === 'O') {
                    OSerial = serial;
                }

                // from DSSP C++ code
                if(!atomDetails.het && atomDetails.name === 'N' && prevCSerial !== undefined && prevOSerial !== undefined) {
                    var dist = me.icn3d.atoms[prevCSerial].coord.distanceTo(me.icn3d.atoms[prevOSerial].coord);

                    var x2 = atomDetails.coord.x + (me.icn3d.atoms[prevCSerial].coord.x - me.icn3d.atoms[prevOSerial].coord.x) / dist;
                    var y2 = atomDetails.coord.y + (me.icn3d.atoms[prevCSerial].coord.y - me.icn3d.atoms[prevOSerial].coord.y) / dist;
                    var z2 = atomDetails.coord.z + (me.icn3d.atoms[prevCSerial].coord.z - me.icn3d.atoms[prevOSerial].coord.z) / dist;

                    atomDetails.hcoord = new THREE.Vector3(x2, y2, z2);
                }

                me.icn3d.atoms[serial] = atomDetails;

                pmin.min(coord);
                pmax.max(coord);
                psum.add(coord);

                var chainid = structure + '_' + chain;
                var resid = chainid + '_' + resi;

                if(me.icn3d.chains[chainid] === undefined) me.icn3d.chains[chainid] = {};
                me.icn3d.chains[chainid][serial] = 1;

                if(me.icn3d.residues[resid] === undefined) me.icn3d.residues[resid] = {};
                me.icn3d.residues[resid][serial] = 1;

                if (bProtein) {
                  me.icn3d.proteins[serial] = 1;

                  if (atomName === 'CA') me.icn3d.calphas[serial] = 1;
                  if (atomName !== 'N' && atomName !== 'CA' && atomName !== 'C' && atomName !== 'O') me.icn3d.sidec[serial] = 1;
                }
                else if (bNucleotide) {
                  me.icn3d.nucleotides[serial] = 1;

                  if (bFull && (atomName == "O3'" || atomName == "O3*")) {
                      me.icn3d.nucleotidesO3[serial] = 1;
                  }
                  else if (!bFull && atomName == 'P') {
                      me.icn3d.nucleotidesO3[serial] = 1;
                  }
                }
                else {
                  if (elem.toLowerCase() === resn.toLowerCase()) {
                      me.icn3d.ions[serial] = 1;
                  }
                  else if(resn === 'HOH' || resn === 'WAT' || resn === 'SQL' || resn === 'H2O' || resn === 'W' || resn === 'DOD' || resn === 'D3O') {
                      me.icn3d.water[serial] = 1;
                  }
                  else {
                      me.icn3d.chemicals[serial] = 1;
                  }
                }

                me.icn3d.dAtoms[serial] = 1;
                me.icn3d.hAtoms[serial] = 1;
            }
        },
        onBond: function( bondData ){
            var from = oriindex2serial[bondData.atomIndex1];
            var to = oriindex2serial[bondData.atomIndex2];

            if(oriindex2serial.hasOwnProperty(bondData.atomIndex1) && oriindex2serial.hasOwnProperty(bondData.atomIndex2)) { // some alt atoms were skipped
                me.icn3d.atoms[from].bonds.push(to);
                me.icn3d.atoms[to].bonds.push(from);

                if(het) {
                    var order = bondData.bondOrder;

                    me.icn3d.atoms[from].bondOrder.push(order);
                    me.icn3d.atoms[to].bondOrder.push(order);

                    if(order === 2) {
                        me.icn3d.doublebonds[from + '_' + to] = 1;
                        me.icn3d.doublebonds[to + '_' + from] = 1;
                    }
                    else if(order === 3) {
                        me.icn3d.triplebonds[from + '_' + to] = 1;
                        me.icn3d.triplebonds[to + '_' + from] = 1;
                    }
                }
            }
        }
    };

    // traverse
    MMTF.traverse( mmtfData, callbackDict );

    // set up disulfide bonds
    var sgLength = SGAtomSerialArray.length;
    for(var i = 0, il = sgLength; i < il; ++i) {
        for(var j = i+1, jl = sgLength; j < il; ++j) {

            var serial1 = SGAtomSerialArray[i];
            var serial2 = SGAtomSerialArray[j];

            var atom1 = me.icn3d.atoms[serial1];
            var atom2 = me.icn3d.atoms[serial2];

            if($.inArray(serial2, atom1.bonds) !== -1) {
                var resid1 = atom1.structure + '_' + atom1.chain + '_' + atom1.resi;
                var resid2 = atom2.structure + '_' + atom2.chain + '_' + atom2.resi;

                if(me.icn3d.ssbondpnts[atom1.structure] === undefined) me.icn3d.ssbondpnts[atom1.structure] = [];

                me.icn3d.ssbondpnts[atom1.structure].push(resid1);
                me.icn3d.ssbondpnts[atom1.structure].push(resid2);
            }
        }
    }

    me.icn3d.cnt = serial;

    if(me.icn3d.cnt > me.icn3d.maxatomcnt || (me.icn3d.biomtMatrices !== undefined && me.icn3d.biomtMatrices.length * me.icn3d.cnt > 10 * me.icn3d.maxatomcnt) ) {
        me.opts['proteins'] = 'c alpha trace'; //ribbon, strand, cylinder and plate, schematic, c alpha trace, b factor tube, lines, stick, ball and stick, sphere, nothing
        me.opts['nucleotides'] = 'o3 trace'; //nucleotide cartoon, o3 trace, schematic, lines, stick,
    }

    me.icn3d.pmin = pmin;
    me.icn3d.pmax = pmax;
    me.icn3d.maxD = pmax.distanceTo(pmin);
    me.icn3d.center = psum.multiplyScalar(1.0 / me.icn3d.cnt);

    if (me.icn3d.maxD < 5) me.icn3d.maxD = 5;
    me.icn3d.oriMaxD = me.icn3d.maxD;
    me.icn3d.oriCenter = me.icn3d.center.clone();

    me.transformToOpmOri(mmtfid);

    if(me.cfg.align === undefined && Object.keys(me.icn3d.structures).length == 1) {
        $("#" + me.pre + "alternateWrapper").hide();
    }

    me.icn3d.setAtomStyleByOptions(me.opts);
    me.icn3d.setColorByOptions(me.opts, me.icn3d.atoms);

    me.renderStructure();

    me.showTitle();

    if(me.cfg.rotate !== undefined) me.rotStruc(me.cfg.rotate, true);

    //if(me.deferred !== undefined) me.deferred.resolve(); if(me.deferred2 !== undefined) me.deferred2.resolve();
};


