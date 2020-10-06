/* ProteinSurface4.js
 * @author David Koes  / https://github.com/3dmol/3Dmol.js/tree/master/3Dmol
 * Modified by Jiyao Wang / https://github.com/ncbi/icn3d
 */

/*  ProteinSurface.js by biochem_fan

Ported and modified for Javascript based on EDTSurf,
  whose license is as follows.

Permission to use, copy, modify, and distribute this program for any
purpose, with or without fee, is hereby granted, provided that this
copyright notice and the reference information appear in all copies or
substantial portions of the Software. It is provided "as is" without
express or implied warranty.

Reference:
http://zhanglab.ccmb.med.umich.edu/EDTSurf/
D. Xu, Y. Zhang (2009) Generating Triangulated Macromolecular Surfaces
by Euclidean Distance Transform. PLoS ONE 4(12): e8140.

=======

TODO: Improved performance on Firefox
      Reduce memory consumption
      Refactor!
 */


// dkoes
// Surface calculations.  This must be safe to use within a web worker.
if (typeof console === 'undefined') {
    // this should only be true inside of a webworker
    console = {
        log : function() {
        }
    };
}

$3Dmol.ProteinSurface = function(threshbox) {
    //"use strict";

    // for delphi
    var dataArray = {};
    var header, data, matrix, isovalue, loadPhiFrom;
    var vpColor = null; // intarray

    // constants for vpbits bitmasks
    /** @var */
    var INOUT = 1;
    /** @var */
    var ISDONE = 2;
    /** @var */
    var ISBOUND = 4;

    var ptranx = 0, ptrany = 0, ptranz = 0;
    var probeRadius = 1.4;
    var defaultScaleFactor = 2;
    var scaleFactor = defaultScaleFactor; // 2 is .5A grid; if this is made user configurable,
                            // also have to adjust offset used to find non-shown
                            // atoms
    var finalScaleFactor = {};

    var pHeight = 0, pWidth = 0, pLength = 0;
    var cutRadius = 0;
    var vpBits = null; // uint8 array of bitmasks
    var vpDistance = null; // floatarray of _squared_ distances
    var vpAtomID = null; // intarray
    var vertnumber = 0, facenumber = 0;
    var pminx = 0, pminy = 0, pminz = 0, pmaxx = 0, pmaxy = 0, pmaxz = 0;

    var bCalcArea = false;
    var atomsToShow = {};

    var vdwRadii = {
            "H" : 1.2,
            "LI" : 1.82,
            "Na" : 2.27,
            "K" : 2.75,
            "C" : 1.7,
            "N" : 1.55,
            "O" : 1.52,
            "F" : 1.47,
            "P" : 1.80,
            "S" : 1.80,
            "CL" : 1.75,
            "BR" : 1.85,
            "SE" : 1.90,
            "ZN" : 1.39,
            "CU" : 1.4,
            "NI" : 1.63,
            "X" : 2
        };

    /** @param {AtomSpec} atom */
    var getVDWIndex = function(atom) {
        if(!atom.elem || typeof(vdwRadii[atom.elem.toUpperCase()]) == "undefined") {
            return "X";
        }
        return atom.elem;
    };

    var depty = {}, widxz = {};
    var faces, verts;
    var nb = [ new Int32Array([ 1, 0, 0 ]), new Int32Array([ -1, 0, 0 ]),
               new Int32Array([ 0, 1, 0 ]), new Int32Array([ 0, -1, 0 ]),
               new Int32Array([ 0, 0, 1 ]),
               new Int32Array([ 0, 0, -1 ]),
               new Int32Array([ 1, 1, 0 ]),
               new Int32Array([ 1, -1, 0 ]),
               new Int32Array([ -1, 1, 0 ]),
               new Int32Array([ -1, -1, 0 ]),
               new Int32Array([ 1, 0, 1 ]),
               new Int32Array([ 1, 0, -1 ]),
               new Int32Array([ -1, 0, 1 ]),
               new Int32Array([ -1, 0, -1 ]),
               new Int32Array([ 0, 1, 1 ]),
               new Int32Array([ 0, 1, -1 ]),
               new Int32Array([ 0, -1, 1 ]),
               new Int32Array([ 0, -1, -1 ]),
               new Int32Array([ 1, 1, 1 ]),
               new Int32Array([ 1, 1, -1 ]),
               new Int32Array([ 1, -1, 1 ]),
               new Int32Array([ -1, 1, 1 ]),
               new Int32Array([ 1, -1, -1 ]),
               new Int32Array([ -1, -1, 1 ]),
               new Int32Array([ -1, 1, -1 ]),
               new Int32Array([ -1, -1, -1 ]) ];

    var origextent;

    var inOrigExtent = function(x, y, z) {
        if (x < origextent[0][0] || x > origextent[1][0])
            return false;
        if (y < origextent[0][1] || y > origextent[1][1])
            return false;
        if (z < origextent[0][2] || z > origextent[1][2])
            return false;
        return true;
    };

    this.getFacesAndVertices = function() {
        var i, il;
        var vertices = verts;
        for (i = 0, il = vertices.length; i < il; i++) {
            vertices[i].x = vertices[i].x / scaleFactor - ptranx;
            vertices[i].y = vertices[i].y / scaleFactor - ptrany;
            vertices[i].z = vertices[i].z / scaleFactor - ptranz;
        }

        var finalfaces = [];
        for (i = 0, il = faces.length; i < il; i += 3) {
            //var f = faces[i];
            var fa = faces[i], fb = faces[i+1], fc = faces[i+2];
            var a = vertices[fa]['atomid'], b = vertices[fb]['atomid'], c = vertices[fc]['atomid'];

            // must be a unique face for each atom
            if (!atomsToShow[a] || !atomsToShow[b] || !atomsToShow[c]) {
                continue;
            }

            if (fa !== fb && fb !== fc && fa !== fc){
                // !!! different between 3Dmol and iCn3D
                finalfaces.push({"a":fa, "b":fb, "c":fc});
            }

        }

        //try to help the garbage collector
        vpBits = null; // uint8 array of bitmasks
        vpDistance = null; // floatarray
        vpAtomID = null; // intarray

        vpColor = null; // intarray

        return {
            'vertices' : vertices,
            'faces' : finalfaces
        };
    };


    this.initparm = function(extent, btype, in_bCalcArea, atomlist
      , inHeader, inData, inMatrix, inIsovalue, inLoadPhiFrom) {
        // for delphi
        header = inHeader;
        dataArray = inData;
        matrix = inMatrix;
        isovalue = inIsovalue;
        loadPhiFrom = inLoadPhiFrom;

        bCalcArea = in_bCalcArea;

        for (i = 0, il = atomlist.length; i < il; i++)
            atomsToShow[atomlist[i]] = 1;

        // !!! different between 3Dmol and iCn3D
        //if(volume > 1000000) //heuristical decrease resolution to avoid large memory consumption
        //    scaleFactor = defaultScaleFactor/2;

        var margin = (1 / scaleFactor) * 5.5; // need margin to avoid
                                                // boundary/round off effects
        origextent = extent;
        pminx = extent[0][0]; pmaxx = extent[1][0];
        pminy = extent[0][1]; pmaxy = extent[1][1];
        pminz = extent[0][2]; pmaxz = extent[1][2];

        if (!btype) {
            pminx -= margin;
            pminy -= margin;
            pminz -= margin;
            pmaxx += margin;
            pmaxy += margin;
            pmaxz += margin;
        } else {
            pminx -= probeRadius + margin;
            pminy -= probeRadius + margin;
            pminz -= probeRadius + margin;
            pmaxx += probeRadius + margin;
            pmaxy += probeRadius + margin;
            pmaxz += probeRadius + margin;
        }

        pminx = Math.floor(pminx * scaleFactor) / scaleFactor;
        pminy = Math.floor(pminy * scaleFactor) / scaleFactor;
        pminz = Math.floor(pminz * scaleFactor) / scaleFactor;
        pmaxx = Math.ceil(pmaxx * scaleFactor) / scaleFactor;
        pmaxy = Math.ceil(pmaxy * scaleFactor) / scaleFactor;
        pmaxz = Math.ceil(pmaxz * scaleFactor) / scaleFactor;

        ptranx = -pminx;
        ptrany = -pminy;
        ptranz = -pminz;

        // !!! different between 3Dmol and iCn3D
        // copied from surface.js from iview
        var boxLength = 129;
        //maxLen = pmaxx - pminx + 2*(probeRadius + 5.5/2)
        var maxLen = pmaxx - pminx;
        if ((pmaxy - pminy) > maxLen) maxLen = pmaxy - pminy;
        if ((pmaxz - pminz) > maxLen) maxLen = pmaxz - pminz;
        scaleFactor = (boxLength - 1.0) / maxLen;

        // 1. typically (size < 90) use the default scale factor 2
        scaleFactor = defaultScaleFactor;

        // 2. If size > 90, change scale
        //var threshbox = 180; // maximum possible boxsize
        if (bCalcArea || defaultScaleFactor * maxLen > threshbox) {
            boxLength = Math.floor(threshbox);
            scaleFactor = (threshbox - 1.0) / maxLen;
        }
        // end of surface.js part

        pLength = Math.ceil(scaleFactor * (pmaxx - pminx)) + 1;
        pWidth = Math.ceil(scaleFactor * (pmaxy - pminy)) + 1;
        pHeight = Math.ceil(scaleFactor * (pmaxz - pminz)) + 1;

        finalScaleFactor.x = (pLength - 1.0) / (pmaxx - pminx);
        finalScaleFactor.y = (pWidth - 1.0) / (pmaxy - pminy);
        finalScaleFactor.z = (pHeight - 1.0) / (pmaxz - pminz);

        this.boundingatom(btype);
        cutRadius = probeRadius * scaleFactor;

        vpBits = new Uint8Array(pLength * pWidth * pHeight);
        vpDistance = new Float64Array(pLength * pWidth * pHeight); // float 32
        vpAtomID = new Int32Array(pLength * pWidth * pHeight);

        vpColor = [];
    };

    this.boundingatom = function(btype) {
        var tradius = [];
        var txz, tdept, sradius, indx;
        //flagradius = btype;

        for ( var i in vdwRadii) {
            if(!vdwRadii.hasOwnProperty(i))
                continue;
            var r = vdwRadii[i];
            if (!btype)
                tradius[i] = r * scaleFactor + 0.5;
            else
                tradius[i] = (r + probeRadius) * scaleFactor + 0.5;

            sradius = tradius[i] * tradius[i];
            widxz[i] = Math.floor(tradius[i]) + 1;
            depty[i] = new Int32Array(widxz[i] * widxz[i]);
            indx = 0;
            for (var j = 0; j < widxz[i]; j++) {
                for (var k = 0; k < widxz[i]; k++) {
                    txz = j * j + k * k;
                    if (txz > sradius)
                        depty[i][indx] = -1; // outside
                    else {
                        tdept = Math.sqrt(sradius - txz);
                        depty[i][indx] = Math.floor(tdept);
                    }
                    indx++;
                }
            }
        }
    };

    this.fillvoxels = function(atoms, atomlist) { // (int seqinit,int
        // seqterm,bool
        // atomtype,atom*
        // proseq,bool bcolor)
        var i, il;
        for (i = 0, il = vpBits.length; i < il; i++) {
            vpBits[i] = 0;
            vpDistance[i] = -1.0;
            vpAtomID[i] = -1;

            vpColor[i] = new THREE.Color();
        }

        for (i in atomlist) {
            var atom = atoms[atomlist[i]];
            if (atom === undefined || atom.resn === 'DUM')
                continue;
            this.fillAtom(atom, atoms);
        }

        // show delphi potential on surface
        if(dataArray) {
            var pminx2 = 0, pmaxx2 = header.xExtent - 1;
            var pminy2 = 0, pmaxy2 = header.yExtent - 1;
            var pminz2 = 0, pmaxz2 = header.zExtent - 1;

            var scaleFactor2 = 1; // angstrom / grid

            var pLength2 = Math.floor(0.5 + scaleFactor2 * (pmaxx2 - pminx2)) + 1;
            var pWidth2 = Math.floor(0.5 + scaleFactor2 * (pmaxy2 - pminy2)) + 1;
            var pHeight2 = Math.floor(0.5 + scaleFactor2 * (pmaxz2 - pminz2)) + 1;

            // fill the color
            var widthHeight2 = pWidth2 * pHeight2;
            var height2 = pHeight2;

            // generate the correctly ordered dataArray
            var vData = new Float32Array(pLength2 * pWidth2 * pHeight2);

            // loop through the delphi box
            for(i = 0; i < pLength2; ++i) {
                for(j = 0; j < pWidth2; ++j) {
                    for(k = 0; k < pHeight2; ++k) {
                        var index = i * widthHeight2 + j * height2 + k;

                        var index2;
                        if(header.filetype == 'phi') { // loop z, y, x
                            index2 = k * widthHeight2 + j * height2 + i;
                        }
                        else if(header.filetype == 'cube') { // loop x, y, z
                            index2 = i * widthHeight2 + j * height2 + k;
                        }

                        if(index2 < dataArray.length) {
                            vData[index] = dataArray[index2];
                        }
                    }
                }
            }

            var widthHeight = pWidth * pHeight;
            var height = pHeight;

            // loop through the surface box
            for(i = 0; i < pLength; ++i) {
                for(j = 0; j < pWidth; ++j) {
                    for(k = 0; k < pHeight; ++k) {
                        var x = i / finalScaleFactor.x - ptranx;
                        var y = j / finalScaleFactor.y - ptrany;
                        var z = k / finalScaleFactor.z - ptranz;

                        var r = new THREE.Vector3(x, y, z);

                        // scale to the grid
                        r.sub(header.ori).multiplyScalar(header.scale);

                        // determine the neighboring grid coordinate
                        var nx0 = Math.floor(r.x), nx1 = Math.ceil(r.x);
                        var ny0 = Math.floor(r.y), ny1 = Math.ceil(r.y);
                        var nz0 = Math.floor(r.z), nz1 = Math.ceil(r.z);
                        if(nx1 == nx0) nx1 = nx0 + 1;
                        if(ny1 == ny0) ny1 = ny0 + 1;
                        if(nz1 == nz0) nz1 = nz0 + 1;

                        if(nx1 > pLength2) nx1 = pLength2;
                        if(ny1 > pWidth2) ny1 = pWidth2;
                        if(nz1 > pHeight2) nz1 = pHeight2;

                        //https://en.wikipedia.org/wiki/Trilinear_interpolation
                        var c000 = vData[nx0 * widthHeight2 + ny0 * height2 + nz0];
                        var c100 = vData[nx1 * widthHeight2 + ny0 * height2 + nz0];
                        var c010 = vData[nx0 * widthHeight2 + ny1 * height2 + nz0];
                        var c001 = vData[nx0 * widthHeight2 + ny0 * height2 + nz1];
                        var c110 = vData[nx1 * widthHeight2 + ny1 * height2 + nz0];
                        var c011 = vData[nx0 * widthHeight2 + ny1 * height2 + nz1];
                        var c101 = vData[nx1 * widthHeight2 + ny0 * height2 + nz1];
                        var c111 = vData[nx1 * widthHeight2 + ny1 * height2 + nz1];

                        var xd = r.x - nx0;
                        var yd = r.y - ny0;
                        var zd = r.z - nz0;

                        var c00 = c000 * (1 - xd) + c100 * xd;
                        var c01 = c001 * (1 - xd) + c101 * xd;
                        var c10 = c010 * (1 - xd) + c110 * xd;
                        var c11 = c011 * (1 - xd) + c111 * xd;

                        var c0 = c00 * (1 - yd) + c10 * yd;
                        var c1 = c01 * (1 - yd) + c11 * yd;

                        var c = c0 * (1 - zd) + c1 * zd;

                        // determine the color based on the potential value
                        if(c > isovalue) c = isovalue;
                        if(c < -isovalue) c = -isovalue;

                        var color;
                        if(c > 0) {
                            c /= 1.0 * isovalue;
                            color = new THREE.Color(1-c, 1-c, 1);
                        }
                        else {
                            c /= -1.0 * isovalue;
                            color = new THREE.Color(1, 1-c, 1-c);
                        }

                        var index = i * widthHeight + j * height + k;

                        vpColor[index] = color;
                    } // for k
                } // for j
            } // for i
        }

        for (i = 0, il = vpBits.length; i < il; i++)
            if (vpBits[i] & INOUT)
                vpBits[i] |= ISDONE;

    };


    this.fillAtom = function(atom, atoms) {
        var cx, cy, cz, ox, oy, oz, mi, mj, mk, i, j, k, si, sj, sk;
        var ii, jj, kk, n;

        // !!! different between 3Dmol and iCn3D
        cx = Math.floor(0.5 + scaleFactor * (atom.coord.x + ptranx));
        cy = Math.floor(0.5 + scaleFactor * (atom.coord.y + ptrany));
        cz = Math.floor(0.5 + scaleFactor * (atom.coord.z + ptranz));

        var at = getVDWIndex(atom);
        var nind = 0;
        var cnt = 0;
        var pWH = pWidth*pHeight;

        for (i = 0, n = widxz[at]; i < n; i++) {
            for (j = 0; j < n; j++) {
                if (depty[at][nind] != -1) {
                    for (ii = -1; ii < 2; ii++) {
                        for (jj = -1; jj < 2; jj++) {
                            for (kk = -1; kk < 2; kk++) {
                                if (ii !== 0 && jj !== 0 && kk !== 0) {
                                    mi = ii * i;
                                    mk = kk * j;
                                    for (k = 0; k <= depty[at][nind]; k++) {
                                        mj = k * jj;
                                        si = cx + mi;
                                        sj = cy + mj;
                                        sk = cz + mk;
                                        if (si < 0 || sj < 0 ||
                                                sk < 0 ||
                                                si >= pLength ||
                                                sj >= pWidth ||
                                                sk >= pHeight)
                                            continue;
                                        var index = si * pWH + sj * pHeight + sk;

                                        if (!(vpBits[index] & INOUT)) {
                                            vpBits[index] |= INOUT;
                                            vpAtomID[index] = atom.serial;
                                        } else {
                                            var atom2 = atoms[vpAtomID[index]];
                                            if(atom2.serial != atom.serial) {
                                                ox = cx + mi - Math.floor(0.5 + scaleFactor *
                                                        (atom2.x + ptranx));
                                                oy = cy + mj - Math.floor(0.5 + scaleFactor *
                                                        (atom2.y + ptrany));
                                                oz = cz + mk - Math.floor(0.5 + scaleFactor *
                                                        (atom2.z + ptranz));
                                                if (mi * mi + mj * mj + mk * mk < ox *
                                                        ox + oy * oy + oz * oz)
                                                    vpAtomID[index] = atom.serial;
                                            }
                                        }

                                    }// k
                                }// if
                            }// kk
                        }// jj
                    }// ii
                }// if
                nind++;
            }// j
        }// i
    };

    this.fillvoxelswaals = function(atoms, atomlist) {
        var i, il;
        for (i = 0, il = vpBits.length; i < il; i++)
            vpBits[i] &= ~ISDONE; // not isdone

        for (i in atomlist) {
            var atom = atoms[atomlist[i]];
            if (atom === undefined)
                continue;

            this.fillAtomWaals(atom, atoms);
        }
    };

    this.fillAtomWaals = function(atom, atoms) {
        var cx, cy, cz, ox, oy, oz, nind = 0;
        var mi, mj, mk, si, sj, sk, i, j, k, ii, jj, kk, n;

        // !!! different between 3Dmol and iCn3D
        cx = Math.floor(0.5 + scaleFactor * (atom.coord.x + ptranx));
        cy = Math.floor(0.5 + scaleFactor * (atom.coord.y + ptrany));
        cz = Math.floor(0.5 + scaleFactor * (atom.coord.z + ptranz));

        var at = getVDWIndex(atom);
        var pWH = pWidth*pHeight;
        for (i = 0, n = widxz[at]; i < n; i++) {
            for (j = 0; j < n; j++) {
                if (depty[at][nind] != -1) {
                    for (ii = -1; ii < 2; ii++) {
                        for (jj = -1; jj < 2; jj++) {
                            for (kk = -1; kk < 2; kk++) {
                                if (ii !== 0 && jj !== 0 && kk !== 0) {
                                    mi = ii * i;
                                    mk = kk * j;
                                    for (k = 0; k <= depty[at][nind]; k++) {
                                        mj = k * jj;
                                        si = cx + mi;
                                        sj = cy + mj;
                                        sk = cz + mk;
                                        if (si < 0 || sj < 0 ||
                                                sk < 0 ||
                                                si >= pLength ||
                                                sj >= pWidth ||
                                                sk >= pHeight)
                                            continue;
                                        var index = si * pWH + sj * pHeight + sk;
                                        if (!(vpBits[index] & ISDONE)) {
                                            vpBits[index] |= ISDONE;
                                            vpAtomID[index] = atom.serial;
                                        }  else {
                                            var atom2 = atoms[vpAtomID[index]];
                                            if(atom2.serial != atom.serial) {
                                                ox = cx + mi - Math.floor(0.5 + scaleFactor *
                                                        (atom2.x + ptranx));
                                                oy = cy + mj - Math.floor(0.5 + scaleFactor *
                                                        (atom2.y + ptrany));
                                                oz = cz + mk - Math.floor(0.5 + scaleFactor *
                                                        (atom2.z + ptranz));
                                                if (mi * mi + mj * mj + mk * mk < ox *
                                                        ox + oy * oy + oz * oz)
                                                    vpAtomID[index] = atom.serial;
                                            }
                                        }
                                    }// k
                                }// if
                            }// kk
                        }// jj
                    }// ii
                }// if
                nind++;
            }// j
        }// i
    };

    this.buildboundary = function() {
        var pWH = pWidth*pHeight;
        for (var i = 0; i < pLength; i++) {
            for (var j = 0; j < pHeight; j++) {
                for (var k = 0; k < pWidth; k++) {
                    var index = i * pWH + k * pHeight + j;
                    if (vpBits[index] & INOUT) {
                        var flagbound = false;
                        var ii = 0;
                        while (ii < 26) {
                            var ti = i + nb[ii][0], tj = j + nb[ii][2], tk = k +
                                    nb[ii][1];
                            if (ti > -1 &&
                                ti < pLength &&
                                tk > -1 &&
                                tk < pWidth &&
                                tj > -1 &&
                                tj < pHeight &&
                                !(vpBits[ti * pWH + tk * pHeight + tj] & INOUT)) {
                                vpBits[index] |= ISBOUND;
                                break;
                            } else
                                ii++;
                        }
                    }
                }
            }
        }
    };

    // a little class for 3d array, should really generalize this and
    // use throughout...
    var PointGrid = function(length, width, height) {
        // the standard says this is zero initialized
        var data = new Int32Array(length * width * height * 3);

        // set position x,y,z to pt, which has ix,iy,and iz
        this.set = function(x, y, z, pt) {
            var index = ((((x * width) + y) * height) + z) * 3;
            data[index] = pt.ix;
            data[index + 1] = pt.iy;
            data[index + 2] = pt.iz;
        };

        // return point at x,y,z
        this.get = function(x, y, z) {
            var index = ((((x * width) + y) * height) + z) * 3;
            return {
                ix : data[index],
                iy : data[index + 1],
                iz : data[index + 2]
            };
        };
    };

    this.fastdistancemap = function() {
        var eliminate = 0;
        var certificate;
        var i, j, k, n;

        var boundPoint = new PointGrid(pLength, pWidth, pHeight);
        var pWH = pWidth*pHeight;
        var cutRSq = cutRadius*cutRadius;

        var inarray = [];
        var outarray = [];

        var index;

        for (i = 0; i < pLength; i++) {
            for (j = 0; j < pWidth; j++) {
                for (k = 0; k < pHeight; k++) {
                    index = i * pWH + j * pHeight + k;
                    vpBits[index] &= ~ISDONE; // isdone = false
                    if (vpBits[index] & INOUT) {
                        if (vpBits[index] & ISBOUND) {
                            var triple = {
                                ix : i,
                                iy : j,
                                iz : k
                            };
                            boundPoint.set(i, j, k, triple);
                            inarray.push(triple);
                            vpDistance[index] = 0;
                            vpBits[index] |= ISDONE;
                            vpBits[index] &= ~ISBOUND;
                        }
                    }
                }
            }
        }

        do {
            outarray = this.fastoneshell(inarray, boundPoint);
            inarray = [];
            for (i = 0, n = outarray.length; i < n; i++) {
                index = pWH * outarray[i].ix + pHeight *
                    outarray[i].iy + outarray[i].iz;
                vpBits[index] &= ~ISBOUND;
                if (vpDistance[index] <= 1.0404 * cutRSq) {
                    inarray.push({
                        ix : outarray[i].ix,
                        iy : outarray[i].iy,
                        iz : outarray[i].iz
                    });
                }
            }
        } while (inarray.length !== 0);

        inarray = [];
        outarray = [];
        boundPoint = null;

        var cutsf = scaleFactor - 0.5;
        if (cutsf < 0)
            cutsf = 0;
        var cutoff = cutRSq - 0.50 / (0.1 + cutsf);
        for (i = 0; i < pLength; i++) {
            for (j = 0; j < pWidth; j++) {
                for (k = 0; k < pHeight; k++) {
                    index = i * pWH + j * pHeight + k;
                    vpBits[index] &= ~ISBOUND;
                    // ses solid
                    if (vpBits[index] & INOUT) {
                        if (!(vpBits[index] & ISDONE) ||
                                ((vpBits[index] & ISDONE) && vpDistance[index] >= cutoff)) {
                            vpBits[index] |= ISBOUND;
                        }
                    }
                }
            }
        }

    };

    this.fastoneshell = function(inarray, boundPoint) { // (int* innum,int
        // *allocout,voxel2
        // ***boundPoint, int*
        // outnum, int *elimi)
        var tx, ty, tz;
        var dx, dy, dz;
        var i, j, n;
        var square;
        var bp, index;
        var outarray = [];
        if (inarray.length === 0)
            return outarray;

        var tnv = {
            ix : -1,
            iy : -1,
            iz : -1
        };
        var pWH = pWidth*pHeight;
        for ( i = 0, n = inarray.length; i < n; i++) {
            tx = inarray[i].ix;
            ty = inarray[i].iy;
            tz = inarray[i].iz;
            bp = boundPoint.get(tx, ty, tz);

            for (j = 0; j < 6; j++) {
                tnv.ix = tx + nb[j][0];
                tnv.iy = ty + nb[j][1];
                tnv.iz = tz + nb[j][2];

                if (tnv.ix < pLength && tnv.ix > -1 && tnv.iy < pWidth &&
                        tnv.iy > -1 && tnv.iz < pHeight && tnv.iz > -1) {
                    index = tnv.ix * pWH + pHeight * tnv.iy + tnv.iz;

                    if ((vpBits[index] & INOUT) && !(vpBits[index] & ISDONE)) {

                        boundPoint.set(tnv.ix, tnv.iy, tz + nb[j][2], bp);
                        dx = tnv.ix - bp.ix;
                        dy = tnv.iy - bp.iy;
                        dz = tnv.iz - bp.iz;
                        square = dx * dx + dy * dy + dz * dz;
                        vpDistance[index] = square;
                        vpBits[index] |= ISDONE;
                        vpBits[index] |= ISBOUND;

                        outarray.push({
                            ix : tnv.ix,
                            iy : tnv.iy,
                            iz : tnv.iz
                        });
                    } else if ((vpBits[index] & INOUT) && (vpBits[index] & ISDONE)) {

                        dx = tnv.ix - bp.ix;
                        dy = tnv.iy - bp.iy;
                        dz = tnv.iz - bp.iz;
                        square = dx * dx + dy * dy + dz * dz;
                        if (square < vpDistance[index]) {
                            boundPoint.set(tnv.ix, tnv.iy, tnv.iz, bp);

                            vpDistance[index] = square;
                            if (!(vpBits[index] & ISBOUND)) {
                                vpBits[index] |= ISBOUND;
                                outarray.push({
                                    ix : tnv.ix,
                                    iy : tnv.iy,
                                    iz : tnv.iz
                                });
                            }
                        }
                    }
                }
            }
        }

        for (i = 0, n = inarray.length; i < n; i++) {
            tx = inarray[i].ix;
            ty = inarray[i].iy;
            tz = inarray[i].iz;
            bp = boundPoint.get(tx, ty, tz);

            for (j = 6; j < 18; j++) {
                tnv.ix = tx + nb[j][0];
                tnv.iy = ty + nb[j][1];
                tnv.iz = tz + nb[j][2];

                if(tnv.ix < pLength && tnv.ix > -1 && tnv.iy < pWidth &&
                        tnv.iy > -1 && tnv.iz < pHeight && tnv.iz > -1) {
                    index = tnv.ix * pWH + pHeight * tnv.iy + tnv.iz;

                    if ((vpBits[index] & INOUT) && !(vpBits[index] & ISDONE)) {
                        boundPoint.set(tnv.ix, tnv.iy, tz + nb[j][2], bp);

                        dx = tnv.ix - bp.ix;
                        dy = tnv.iy - bp.iy;
                        dz = tnv.iz - bp.iz;
                        square = dx * dx + dy * dy + dz * dz;
                        vpDistance[index] = square;
                        vpBits[index] |= ISDONE;
                        vpBits[index] |= ISBOUND;

                        outarray.push({
                            ix : tnv.ix,
                            iy : tnv.iy,
                            iz : tnv.iz
                        });
                    } else if ((vpBits[index] & INOUT) && (vpBits[index] & ISDONE)) {
                        dx = tnv.ix - bp.ix;
                        dy = tnv.iy - bp.iy;
                        dz = tnv.iz - bp.iz;
                        square = dx * dx + dy * dy + dz * dz;
                        if (square < vpDistance[index]) {
                            boundPoint.set(tnv.ix, tnv.iy, tnv.iz, bp);
                            vpDistance[index] = square;
                            if (!(vpBits[index] & ISBOUND)) {
                                vpBits[index] |= ISBOUND;
                                outarray.push({
                                    ix : tnv.ix,
                                    iy : tnv.iy,
                                    iz : tnv.iz
                                });
                            }
                        }
                    }
                }
            }
        }

        for (i = 0, n = inarray.length; i < n; i++) {
            tx = inarray[i].ix;
            ty = inarray[i].iy;
            tz = inarray[i].iz;
            bp = boundPoint.get(tx, ty, tz);

            for (j = 18; j < 26; j++) {
                tnv.ix = tx + nb[j][0];
                tnv.iy = ty + nb[j][1];
                tnv.iz = tz + nb[j][2];

                if (tnv.ix < pLength && tnv.ix > -1 && tnv.iy < pWidth &&
                        tnv.iy > -1 && tnv.iz < pHeight && tnv.iz > -1) {
                    index = tnv.ix * pWH + pHeight * tnv.iy + tnv.iz;

                    if ((vpBits[index] & INOUT) && !(vpBits[index] & ISDONE)) {
                        boundPoint.set(tnv.ix, tnv.iy, tz + nb[j][2], bp);

                        dx = tnv.ix - bp.ix;
                        dy = tnv.iy - bp.iy;
                        dz = tnv.iz - bp.iz;
                        square = dx * dx + dy * dy + dz * dz;
                        vpDistance[index] = square;
                        vpBits[index] |= ISDONE;
                        vpBits[index] |= ISBOUND;

                        outarray.push({
                            ix : tnv.ix,
                            iy : tnv.iy,
                            iz : tnv.iz
                        });
                    } else if ((vpBits[index] & INOUT)  && (vpBits[index] & ISDONE)) {
                        dx = tnv.ix - bp.ix;
                        dy = tnv.iy - bp.iy;
                        dz = tnv.iz - bp.iz;
                        square = dx * dx + dy * dy + dz * dz;
                        if (square < vpDistance[index]) {
                            boundPoint.set(tnv.ix, tnv.iy, tnv.iz, bp);

                            vpDistance[index] = square;
                            if (!(vpBits[index] & ISBOUND)) {
                                vpBits[index] |= ISBOUND;
                                outarray.push({
                                    ix : tnv.ix,
                                    iy : tnv.iy,
                                    iz : tnv.iz
                                });
                            }
                        }
                    }
                }
            }
        }

        return outarray;
    };

    this.marchingcubeinit = function(stype) {
        for ( var i = 0, lim = vpBits.length; i < lim; i++) {
            if (stype == 1) {// vdw
                vpBits[i] &= ~ISBOUND;
            } else if (stype == 4) { // ses
                vpBits[i] &= ~ISDONE;
                if (vpBits[i] & ISBOUND)
                    vpBits[i] |= ISDONE;
                vpBits[i] &= ~ISBOUND;
            } else if (stype == 2) {// after vdw
                if ((vpBits[i] & ISBOUND) && (vpBits[i] & ISDONE))
                    vpBits[i] &= ~ISBOUND;
                else if ((vpBits[i] & ISBOUND) && !(vpBits[i] & ISDONE))
                    vpBits[i] |= ISDONE;
            } else if (stype == 3) { // sas
                vpBits[i] &= ~ISBOUND;
            }
        }
    };

    // this code allows me to empirically prune the marching cubes code tables
    // to more efficiently handle discrete data
    var counter = function() {
        var data = Array(256);
        for ( var i = 0; i < 256; i++)
            data[i] = [];

        this.incrementUsed = function(i, j) {
            if (typeof data[i][j] === 'undefined')
                data[i][j] = {
                    used : 0,
                    unused : 0
                };
            data[i][j].used++;
        };

        this.incrementUnused = function(i, j) {
            if (typeof data[i][j] === 'undefined')
                data[i][j] = {
                    used : 0,
                    unused : 0
                };
            data[i][j].unused++;

        };

        var redoTable = function(triTable) {
            var str = "[";
            for ( var i = 0; i < triTable.length; i++) {
                var code = 0;
                var table = triTable[i];
                for ( var j = 0; j < table.length; j++) {
                    code |= (1 << (table[j]));
                }
                str += "0x" + code.toString(16) + ", ";
            }
            str += "]";
        };

        this.print = function() {

            var table = MarchingCube.triTable;
            var str;
            var newtable = [];
            for ( var i = 0; i < table.length; i++) {
                var newarr = [];
                for ( var j = 0; j < table[i].length; j += 3) {
                    var k = j / 3;
                    if (typeof data[i][k] === 'undefined' || !data[i][k].unused) {
                        newarr.push(table[i][j]);
                        newarr.push(table[i][j + 1]);
                        newarr.push(table[i][j + 2]);
                    }
                    if (typeof data[i][k] === 'undefined')
                        console.log("undef " + i + "," + k);
                }
                newtable.push(newarr);
            }
            redoTable(newtable);
        };
    };

    this.marchingcube = function(stype) {
        this.marchingcubeinit(stype);
        verts = []; faces = [];
        $3Dmol.MarchingCube.march(vpBits, verts, faces, {
            smooth : 1,
            nX : pLength,
            nY : pWidth,
            nZ : pHeight
        });

        var pWH = pWidth*pHeight;
        for (var i = 0, vlen = verts.length; i < vlen; i++) {
            verts[i]['atomid'] = vpAtomID[verts[i].x * pWH + pHeight *
                    verts[i].y + verts[i].z];
            if(dataArray) verts[i]['color'] = vpColor[verts[i].x * pWH + pHeight *
                    verts[i].y + verts[i].z];
        }

        // calculate surface area
        var serial2area, maxScaleFactor, area = 0;
        if(bCalcArea) {
            var faceHash = {};
            serial2area = {};
            for(var i = 0, il = faces.length; i < il; i += 3) {
                var fa = faces[i], fb = faces[i+1], fc = faces[i+2];

                if (fa == fb || fb == fc || fa == fc) continue;

                var fmin = Math.min(fa, fb, fc);
                var fmax = Math.max(fa, fb, fc);
                var fmid = fa + fb + fc - fmin - fmax;
                var fmin_fmid_fmax = fmin + '_' + fmid + '_' + fmax;

                if(faceHash.hasOwnProperty(fmin_fmid_fmax)) {
                    continue;
                }

                faceHash[fmin_fmid_fmax] = 1;

                var ai = verts[fa]['atomid'], bi = verts[fb]['atomid'], ci = verts[fc]['atomid'];

                if (!atomsToShow[ai] || !atomsToShow[bi] || !atomsToShow[ci]) {
                    continue;
                }

                //if (fa !== fb && fb !== fc && fa !== fc){
                    var a = verts[fa];
                    var b = verts[fb];
                    var c = verts[fc];

                    var ab2 = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z);
                    var ac2 = (a.x - c.x) * (a.x - c.x) + (a.y - c.y) * (a.y - c.y) + (a.z - c.z) * (a.z - c.z);
                    var cb2 = (c.x - b.x) * (c.x - b.x) + (c.y - b.y) * (c.y - b.y) + (c.z - b.z) * (c.z - b.z);

                    var min = Math.min(ab2, ac2, cb2);
                    var max = Math.max(ab2, ac2, cb2);
                    var mid = ab2 + ac2 + cb2 - min - max;

                    // there are only three kinds of triangles as shown at
                    // https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0008140
                    // case 1: 1, 1, sqrt(2)     area: 0.5 * a * a;
                    // case 2: sqrt(2), sqrt(2), sqrt(2)    area: 0.5 * a * a * sqrt(3) * 0.5;
                    // case 3: 1, sqrt(2), sqrt(3)      area: 0.5 * a * b
                    var currArea = 0;
                    if(parseInt((max - min)*100) == 0) { // case 2
                        currArea = 0.433 * min;
                    }
                    else if(parseInt((mid - min)*100) == 0) { // case 1
                        currArea = 0.5 * min;
                    }
                    else { // case 3
                        currArea = 0.707 * min;
                    }

                    var partArea = currArea / 3;

                    if(serial2area[ai] === undefined) serial2area[ai] = partArea;
                    else serial2area[ai] += partArea;

                    if(serial2area[bi] === undefined) serial2area[bi] = partArea;
                    else serial2area[bi] += partArea;

                    if(serial2area[ci] === undefined) serial2area[ci] = partArea;
                    else serial2area[ci] += partArea;

                    area += currArea;
                //}
            } // for loop

            maxScaleFactor = Math.max(finalScaleFactor.x, finalScaleFactor.y, finalScaleFactor.z);
            area = area / maxScaleFactor / maxScaleFactor;
            //area = area / scaleFactor / scaleFactor;
        }

        if(!bCalcArea) $3Dmol.MarchingCube.laplacianSmooth(1, verts, faces);

        return {"area": area, "serial2area": serial2area, "scaleFactor": maxScaleFactor};
    };


};
