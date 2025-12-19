dragControls.addEventListener('drag', (e) => {
            const mesh = e.object;
            const group = mesh.parent;
            const t = app.trailers.find(x => x.id === app.activeTrailer);
            const item = app.load.find(x => x.uid === group.userData.uid);

            // SPEED FIX: Multiply mesh movement by a factor (0.2 = 20% speed)
            // This prevents the item from "zipping" away from the cursor
            const speedFactor = 0.2;
            mesh.position.multiplyScalar(speedFactor);

            // Apply the throttled movement to the group
            group.position.add(mesh.position);
            
            // Reset mesh to local center so movement doesn't compound
            mesh.position.set(0, 0, 0);

            const hL = (t.l*SCALAR)/2, hW = (t.w*SCALAR)/2, hH = (t.h*SCALAR);
            const halfItemL = (item.l*SCALAR)/2, halfItemW = (item.w*SCALAR)/2, halfItemH = (item.h*SCALAR)/2;

            // Boundaries (Keep inside trailer)
            if(group.position.x - halfItemL < -hL) group.position.x = -hL + halfItemL;
            if(group.position.x + halfItemL > hL) group.position.x = hL - halfItemL;
            if(group.position.z - halfItemW < -hW) group.position.z = -hW + halfItemW;
            if(group.position.z + halfItemW > hW) group.position.z = hW - halfItemW;
            
            if(group.position.y - halfItemH < 0) group.position.y = halfItemH;
            if(group.position.y + halfItemH > hH) group.position.y = hH - halfItemH;

            // Save state
            item.x = (group.position.x + hL - halfItemL) / SCALAR;
            item.z = (group.position.z + hW - halfItemW) / SCALAR;
            item.y = (group.position.y - halfItemH) / SCALAR;
        });