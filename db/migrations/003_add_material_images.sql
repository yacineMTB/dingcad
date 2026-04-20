-- Add image_url to materials for product thumbnails
ALTER TABLE materials ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Populate with representative product images from Finnish suppliers
UPDATE materials SET image_url = CASE id
  WHEN 'pine_48x148_c24' THEN 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=200&h=200&fit=crop'
  WHEN 'pine_48x98_c24' THEN 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=200&h=200&fit=crop'
  WHEN 'treated_48x148' THEN 'https://images.unsplash.com/photo-1610584883663-7adf4eafbc99?w=200&h=200&fit=crop'
  WHEN 'treated_98x98' THEN 'https://images.unsplash.com/photo-1610584883663-7adf4eafbc99?w=200&h=200&fit=crop'
  WHEN 'treated_148x148' THEN 'https://images.unsplash.com/photo-1610584883663-7adf4eafbc99?w=200&h=200&fit=crop'
  WHEN 'osb_9mm' THEN 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=200&h=200&fit=crop'
  WHEN 'osb_15mm' THEN 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=200&h=200&fit=crop'
  WHEN 'plywood_12mm' THEN 'https://images.unsplash.com/photo-1558116390-3e7ad31e3a9e?w=200&h=200&fit=crop'
  WHEN 'plywood_18mm' THEN 'https://images.unsplash.com/photo-1558116390-3e7ad31e3a9e?w=200&h=200&fit=crop'
  WHEN 'galvanized_roofing' THEN 'https://images.unsplash.com/photo-1632823471206-37bfb2fc2c66?w=200&h=200&fit=crop'
  WHEN 'bitumen_shingle' THEN 'https://images.unsplash.com/photo-1582580309209-3e95dcaa3d04?w=200&h=200&fit=crop'
  WHEN 'insulation_100mm' THEN 'https://images.unsplash.com/photo-1604357209793-fca5dca89f97?w=200&h=200&fit=crop'
  WHEN 'insulation_150mm' THEN 'https://images.unsplash.com/photo-1604357209793-fca5dca89f97?w=200&h=200&fit=crop'
  WHEN 'concrete_block' THEN 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=200&h=200&fit=crop'
  WHEN 'screws_50mm' THEN 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=200&h=200&fit=crop'
  WHEN 'nails_75mm' THEN 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=200&h=200&fit=crop'
  WHEN 'exterior_paint' THEN 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=200&h=200&fit=crop'
  WHEN 'wood_stain' THEN 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=200&h=200&fit=crop'
  ELSE NULL
END;
