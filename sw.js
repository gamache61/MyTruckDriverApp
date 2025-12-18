<script>
    const STORAGE_KEY = "loadmaster_data_v1";
    let app = { customers: [], library: [], trailers: [{id: 1, name: "Standard 53'", l: 636, w: 102, h: 110}], activeTrailer: 1, load: [] };
    let selectedUID = null, scene, camera, renderer, orbit, dragControls, meshes = [], trailerMesh;
    const SCALAR = 0.05;

    window.onload = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) app = JSON.parse(saved);
        renderUI(); init3D();
        window.addEventListener('resize', onResize);
    };

    function addLoad() {
        const cId = document.getElementById('cust-select').value;
        const iId = document.getElementById('item-select').value;
        if(cId === "Customer..." || iId === "Item...") return;
        const template = app.library.find(x => x.id == iId);
        const trailer = app.trailers.find(x => x.id === app.activeTrailer);
        let furthestFront = trailer.l;
        app.load.forEach(i => { if(i.x < furthestFront) furthestFront = i.x; });
        let newX = Math.max(0, furthestFront - template.l);
        app.load.push({ uid: Date.now(), name: template.name, l: template.l, w: template.w, h: template.h, wt: parseFloat(document.getElementById('load-wt').value)||0, color: template.color, x: newX, y: 0, z: 0, cId: cId });
        saveAndRefresh();
    }

    function init3D() {
        const cont = document.getElementById('canvas-container');
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(50, cont.clientWidth/cont.clientHeight, 0.1, 1000);
        camera.position.set(60, 60, 60);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(cont.clientWidth, cont.clientHeight);
        cont.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        orbit = new THREE.OrbitControls(camera, renderer.domElement);
        buildTrailer3D(); buildLoad3D(); animate();
    }

    function buildTrailer3D() {
        if(trailerMesh) scene.remove(trailerMesh);
        const t = app.trailers.find(x => x.id === app.activeTrailer);
        const geo = new THREE.BoxGeometry(t.l*SCALAR, t.h*SCALAR, t.w*SCALAR);
        trailerMesh = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({color: 0x22c55e}));
        trailerMesh.position.y = (t.h*SCALAR)/2;
        scene.add(trailerMesh);
    }

    function buildLoad3D() {
        // 1. Clean up existing objects
        meshes.forEach(m => scene.remove(m)); 
        meshes = [];
        if(dragControls) dragControls.dispose();
        
        const t = app.trailers.find(x => x.id === app.activeTrailer);

        app.load.forEach(item => {
            const group = new THREE.Group();
            const geo = new THREE.BoxGeometry(item.l*SCALAR, item.h*SCALAR, item.w*SCALAR);
            
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            const cust = app.customers.find(c => String(c.id) === String(item.cId));
            const label = cust ? cust.name : "N/A";

            ctx.fillStyle = item.color;
            ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = 'black';
            ctx.font = 'bold 60px Arial'; 
            ctx.textAlign = 'center';
            ctx.fillText(label, 256, 256);
            
            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.MeshLambertMaterial({ map: texture, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
            const mesh = new THREE.Mesh(geo, mat);

            const wire = new THREE.LineSegments(
                new THREE.EdgesGeometry(geo),
                new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
            );
            
            group.add(mesh);
            group.add(wire); 
            
            // Positioning
            group.position.set(
                (item.x*SCALAR) - ((t.l*SCALAR)/2) + ((item.l*SCALAR)/2), 
                (item.y*SCALAR) + ((item.h*SCALAR)/2), 
                (item.z*SCALAR) - ((t.w*SCALAR)/2) + ((item.w*SCALAR)/2)
            );
            
            group.userData = { uid: item.uid };
            scene.add(group); 
            
            // DragControls must track the Mesh inside the Group
            meshes.push(mesh);
        });

        // 2. Re-initialize DragControls with the correct array
        dragControls = new THREE.DragControls(meshes, camera, renderer.domElement);
        
        dragControls.addEventListener('dragstart', function (event) {
            orbit.enabled = false;
            const group = event.object.parent;
            selectedUID = group.userData.uid;
            document.getElementById('side-delete-wrapper').classList.remove('hidden');
        });

        dragControls.addEventListener('drag', function (event) {
            const mesh = event.object;
            const group = mesh.parent;
            const t = app.trailers.find(x => x.id === app.activeTrailer);
            const itemData = app.load.find(x => x.uid === group.userData.uid);

            if (!itemData) return;

            const hL = (t.l * SCALAR) / 2;
            const hW = (t.w * SCALAR) / 2;

            // Apply movement to the GROUP
            group.position.x = mesh.position.x + group.position.x;
            group.position.z = mesh.position.z + group.position.z;
            group.position.y = (itemData.h * SCALAR) / 2; // Keep it on the floor

            // Boundary checks
            if (group.position.x - (itemData.l*SCALAR)/2 < -hL) group.position.x = -hL + (itemData.l*SCALAR)/2;
            if (group.position.x + (itemData.l*SCALAR)/2 > hL) group.position.x = hL - (itemData.l*SCALAR)/2;
            if (group.position.z - (itemData.w*SCALAR)/2 < -hW) group.position.z = -hW + (itemData.w*SCALAR)/2;
            if (group.position.z + (itemData.w*SCALAR)/2 > hW) group.position.z = hW - (itemData.w*SCALAR)/2;

            // Reset mesh local position to 0 so the group "takes over" the location
            mesh.position.set(0, 0, 0);

            // Update app state
            itemData.x = (group.position.x + hL - (itemData.l*SCALAR)/2) / SCALAR;
            itemData.z = (group.position.z + hW - (itemData.w*SCALAR)/2) / SCALAR;
        });

        dragControls.addEventListener('dragend', function () {
            orbit.enabled = true;
            saveToStorage();
        });
    }

    function renderUI() {
        document.getElementById('cust-select').innerHTML = "<option>Customer...</option>" + app.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        document.getElementById('item-select').innerHTML = "<option>Item...</option>" + app.library.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
        document.getElementById('cust-list').innerHTML = app.customers.map(c => `<div class="list-item"><b>${c.name}</b></div>`).join('');
        document.getElementById('library-list').innerHTML = app.library.map(i => `<div class="list-item" style="border-color:${i.color}"><b>${i.name}</b></div>`).join('');
        document.getElementById('trailer-list').innerHTML = app.trailers.map(t => `<div class="list-item"><b>${t.name}</b></div>`).join('');
        document.getElementById('load-summary').innerText = `${app.load.length} items | ${app.load.reduce((a,b)=>a+(b.wt||0),0).toLocaleString()} lbs`;
    }

    function saveAndRefresh() { saveToStorage(); renderUI(); buildLoad3D(); }
    function saveToStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(app)); }
    function saveCustomer() { const n = document.getElementById('c-name').value; if(n) app.customers.push({id:Date.now(), name:n}); saveAndRefresh(); }
    function saveLibItem() { const n = document.getElementById('lib-name').value, l=Number(document.getElementById('lib-l').value), w=Number(document.getElementById('lib-w').value), h=Number(document.getElementById('lib-h').value), c=document.getElementById('lib-color').value; if(n&&l) app.library.push({id:Date.now(), name:n, l, w, h, color:c}); saveAndRefresh(); }
    function saveTrailer() { const n = document.getElementById('t-name').value, l=Number(document.getElementById('t-l').value)*12, w=Number(document.getElementById('t-w').value)*12, h=Number(document.getElementById('t-h').value)*12; if(n&&l) app.trailers.push({id:Date.now(), name:n, l, w, h}); saveAndRefresh(); }
    function deleteSelected() { app.load = app.load.filter(i => i.uid !== selectedUID); document.getElementById('side-delete-wrapper').classList.add('hidden'); saveAndRefresh(); }
    function exportLoad() { downloadJSON(app, "LoadPlan.json"); }
    function exportCustomers() { downloadJSON({customers:app.customers, library:app.library}, "CustData.json"); }
    function downloadJSON(obj, name) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(obj)],{type:'application/json'})); a.download=name; a.click(); }
    function importData(input) { const r = new FileReader(); r.onload = (e) => { try { const json = JSON.parse(e.target.result); if(json.load) app = { ...app, ...json }; else if(json.customers) app = { ...app, ...json }; saveAndRefresh(); alert("Imported!"); } catch(err) { alert("Invalid File"); } }; r.readAsText(input.files[0]); }
    function switchTab(id) { document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); document.getElementById(id + '-tab').classList.add('active'); const btns = document.querySelectorAll('.sidebar:first-child .side-btn'); btns.forEach(b => b.classList.remove('active-tab')); if(id==='main') btns[0].classList.add('active-tab'); if(id==='customers') btns[1].classList.add('active-tab'); if(id==='library') btns[2].classList.add('active-tab'); if(id==='trailers') btns[3].classList.add('active-tab'); }
    function animate() { requestAnimationFrame(animate); orbit.update(); renderer.render(scene, camera); }
    function onResize() { const c = document.getElementById('canvas-container'); camera.aspect = c.clientWidth/c.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(c.clientWidth, c.clientHeight); }
    function hardReset() { if(confirm("Reset?")) { localStorage.clear(); location.reload(); } }
</script>