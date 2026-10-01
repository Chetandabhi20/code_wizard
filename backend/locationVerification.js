const exifr = require('exifr');
const fs = require('fs');

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c; 
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

async function verifyImageLocation(req, res, next) {
    // Skip if no file was uploaded
    if (!req.file || !req.file.path) {
        return next();
    }
    
    const frontendLat = parseFloat(req.body.latitude);
    const frontendLon = parseFloat(req.body.longitude);

    // If no frontend GPS coords provided, just skip verification
    if (isNaN(frontendLat) || isNaN(frontendLon)) {
        return next();
    }

    try {
        const exifData = await exifr.gps(req.file.path);

        // If no EXIF GPS data, allow the image (most photos don't have EXIF GPS)
        if (!exifData || exifData.latitude === undefined || exifData.longitude === undefined) {
            req.locationVerification = {
                verified: false,
                reason: 'No EXIF GPS data found - accepted without location verification'
            };
            return next();
        }

        const distanceMeters = getDistanceFromLatLonInMeters(
            frontendLat, 
            frontendLon,
            exifData.latitude, 
            exifData.longitude
        );

        if (distanceMeters > 5000) {
            // Only reject if more than 5km away - clearly a different location
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                success: false,
                error: `Image GPS location is ${Math.round(distanceMeters/1000)}km from your reported location. Please use a photo taken at the scene.`
            });
        }

        req.locationVerification = {
            verified: true,
            discrepancyMeters: Math.round(distanceMeters)
        };
        
        next();
    } catch (error) {
        console.error('Error parsing EXIF data:', error);
        // On error, just allow through
        req.locationVerification = {
            verified: false,
            reason: 'EXIF parsing error - accepted without location verification'
        };
        next();
    }
}

module.exports = {
    verifyImageLocation
};
