/* setupsurface.js from SurfaceWorker.js
 * @author David Koes  / https://github.com/3dmol/3Dmol.js/tree/master/3Dmol
 * Modified by Jiyao Wang / https://github.com/ncbi/icn3d
 */

$3Dmol.SetupSurface = function (data) {
    var me = this, ic = me.icn3d; "use strict";

    //var $3Dmol = $3Dmol || {};

    //var vol = $3Dmol.volume(data.extent);
    var vol = undefined;

    var threshbox = data.threshbox; // maximum possible boxsize, default 180

    var ps = new $3Dmol.ProteinSurface(threshbox);
    ps.initparm(data.extent, (data.type === 1) ? false : true, data.bCalcArea, data.atomsToShow
      , data.header, data.data, data.matrix, data.isovalue, data.loadPhiFrom);

    ps.fillvoxels(data.allatoms, data.extendedAtoms);

    ps.buildboundary();

    //if (data.type === 4 || data.type === 2) {
    if (data.type === 2) {
        ps.fastdistancemap();
        ps.boundingatom(false);
        ps.fillvoxelswaals(data.allatoms, data.extendedAtoms);
    }

    //ps.marchingcube(data.type);
    var area_serial2area = ps.marchingcube();

    ps.vpBits = null; // uint8 array of bitmasks
    ps.vpDistance = null; // floatarray of _squared_ distances
    ps.vpAtomID = null; // intarray

    var result = ps.getFacesAndVertices(data.atomsToShow);
    result.area = area_serial2area.area;
    result.serial2area = area_serial2area.serial2area;
    result.scaleFactor = area_serial2area.scaleFactor;

    ps.faces = null;
    ps.verts = null;

    return result;
};

