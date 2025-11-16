# Shotengai Atlas - Mapbox Version

This is a conversion of the Shotengai Atlas from Leaflet to Mapbox GL JS, maintaining the same layout and functionality while leveraging Mapbox's superior performance and built-in snapping capabilities.

## Key Improvements Over Leaflet Version

### 1. **Native Snapping Support**
- Mapbox Draw includes built-in snapping functionality
- No need for external plugins (leaflet.snap, leaflet.geometryutil)
- More reliable vertex snapping when drawing and editing
- Cleaner, more maintainable code

### 2. **Better Performance**
- Vector tiles for smoother rendering
- WebGL-based rendering for large datasets
- Better zoom/pan performance
- Optimized for mobile devices

### 3. **Modern Mapping Features**
- Built-in geocoding control
- Better styling capabilities
- Smooth animations
- 3D terrain support (can be added)

### 4. **Cleaner Architecture**
- No plugin dependency conflicts
- Single drawing library (Mapbox Draw)
- Better event handling
- Simplified layer management

## Setup Instructions

### 1. Get a Mapbox Access Token

1. Go to [Mapbox](https://www.mapbox.com/)
2. Create a free account
3. Navigate to your [Account](https://account.mapbox.com/) page
4. Copy your "Default public token" or create a new one
5. Free tier includes:
   - 50,000 map loads per month
   - Unlimited geocoding requests
   - All features used in this app

### 2. Configure the Application

Open `atlas-mapbox.js` and replace the placeholder token on line 8:

```javascript
// IMPORTANT: Replace with your own Mapbox token
mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN_HERE';
```

Replace `'YOUR_MAPBOX_ACCESS_TOKEN_HERE'` with your actual token from Mapbox.

### 3. File Structure

Make sure you have the following files in your project:

```
your-project/
├── map-mapbox.html          # Main HTML file
├── atlas-mapbox.css         # Styles (maintains original design)
├── atlas-mapbox.js          # Main application logic with Mapbox
└── assets/
    └── logo.svg            # Your logo file
```

### 4. Deploy

You can deploy this to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- Your own server

**Important**: The Supabase credentials are already configured in the code, so you don't need to change those unless you want to use a different database.

## Key Differences from Leaflet Version

### Map Initialization

**Leaflet:**
```javascript
const map = L.map("map", { 
  center: [36.2048, 137.2529], 
  zoom: 5, 
  layers: [basemaps.dark] 
});
```

**Mapbox:**
```javascript
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [137.2529, 36.2048],
  zoom: 5
});
```

### Drawing Features

**Leaflet:** Required multiple plugins (Leaflet.Draw, Leaflet.Snap, Leaflet.GeometryUtil)

**Mapbox:** Single plugin (Mapbox Draw) with built-in snapping:
```javascript
let draw = new MapboxDraw({
  displayControlsDefault: false,
  controls: {
    line_string: true,
    trash: true
  }
});
```

### Layer Management

**Leaflet:** Used FeatureGroups and individual layers

**Mapbox:** Uses sources and layers:
```javascript
map.addSource('shotengai', {
  type: 'geojson',
  data: geojsonData
});

map.addLayer({
  id: 'shotengai-lines',
  type: 'line',
  source: 'shotengai',
  paint: { /* styling */ }
});
```

### Event Handling

**Leaflet:**
```javascript
layer.on("click", () => showInfo(feature));
```

**Mapbox:**
```javascript
map.on('click', 'shotengai-lines', (e) => {
  const feature = e.features[0];
  showInfo(feature);
});
```

## Features Maintained

All original features are preserved:

✅ **Search & Filter**
- Text search across name, city, prefecture
- Prefecture dropdown filter
- Real-time results with statistics

✅ **Data Summary**
- Total features count
- Prefecture coverage
- Length statistics (total, average, median)
- Status breakdown

✅ **Info Panel**
- Detailed feature information
- Photo gallery with navigation
- Edit capabilities for authenticated users

✅ **Authentication**
- Supabase auth integration
- Role-based editing
- Secure photo uploads

✅ **Drawing & Editing**
- Create new Shotengai lines
- Edit existing geometry
- Delete features
- **NEW: Built-in vertex snapping**

✅ **Photo Management**
- Drag & drop upload
- Multiple photos per feature
- Thumbnail preview
- Storage in Supabase

## Supabase Configuration

The application uses the existing Supabase setup:

- **Database**: `v_shotengai_geojson` view for fetching features
- **Storage**: `shotengai-photos` bucket for images
- **RPC Functions**: 
  - `upsert_shotengai` - Insert/update features
  - `update_shotengai_geom` - Update geometry only
- **Auth**: Email/password authentication

No changes needed to your Supabase configuration!

## Styling Customization

The CSS has been adapted for Mapbox controls while maintaining your original design:

- Dark theme with custom colors
- Mapbox controls styled to match your UI
- Same card-based layout
- Responsive design preserved

To customize colors, edit the CSS variables in `atlas-mapbox.css`:

```css
:root {
  --bg: #0b0d10;
  --panel: #12161b;
  --muted: #98a2b3;
  --text: #e5e7eb;
  --brand: #6aa0ff;
  --accent: #14b8a6;
  --border: #1f2937;
}
```

## Browser Support

Mapbox GL JS requires WebGL support:

✅ Chrome/Edge 65+
✅ Firefox 64+
✅ Safari 12+
✅ iOS Safari 12+
✅ Android Chrome 67+

For older browsers, consider using [Mapbox GL JS v1.13.3](https://docs.mapbox.com/mapbox-gl-js/guides/install/#version-1x) which has broader support.

## Performance Tips

1. **Use appropriate zoom levels**: The app is optimized for zoom 5-18
2. **Enable clustering** (optional): For very large datasets, you can add point clustering
3. **Optimize images**: Compress photos before upload to reduce load times
4. **Use CDN**: Host static assets on a CDN for better global performance

## Troubleshooting

### Map doesn't load
- Check that you've set your Mapbox access token
- Check browser console for errors
- Verify your token has the correct permissions

### Features don't appear
- Check Supabase connection
- Verify the `v_shotengai_geojson` view exists
- Check browser console for data loading errors

### Drawing doesn't work
- Ensure you're signed in
- Click "Edit Map" to enable edit mode
- Check that Mapbox Draw is properly loaded

### Snapping not working
- Mapbox Draw's snapping works automatically when vertices are close
- Try zooming in closer for better precision
- Snapping distance is set to default (can be customized if needed)

## Migration Checklist

- [ ] Set up Mapbox account
- [ ] Get access token
- [ ] Update `atlas-mapbox.js` with your token
- [ ] Test locally
- [ ] Verify all features work:
  - [ ] Map loads
  - [ ] Features display
  - [ ] Search works
  - [ ] Filters work
  - [ ] Info panel shows
  - [ ] Login works
  - [ ] Drawing works
  - [ ] Editing works
  - [ ] Photos upload
- [ ] Deploy to production
- [ ] Update any documentation/links

## Future Enhancements

Possible additions with Mapbox:

1. **3D Buildings**: Add 3D building layer for context
2. **Custom Basemaps**: Create custom map styles in Mapbox Studio
3. **Heatmaps**: Visualize Shotengai density
4. **Animations**: Animate transitions and feature additions
5. **Offline Support**: Cache tiles for offline use
6. **Satellite Imagery**: Toggle satellite view
7. **Street View Integration**: Link to Google Street View

## Support

For issues specific to:
- **Mapbox**: [Mapbox Support](https://support.mapbox.com/)
- **Supabase**: [Supabase Docs](https://supabase.com/docs)
- **This Application**: Check browser console and verify setup steps

## License

This application maintains the same license as the original Shotengai Atlas project.

---

**Built with:**
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [Mapbox Draw](https://github.com/mapbox/mapbox-gl-draw)
- [Supabase](https://supabase.com/)
- Vanilla JavaScript (ES6+)
