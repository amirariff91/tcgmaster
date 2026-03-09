import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/collection/', '/settings/'],
      },
    ],
    sitemap: 'https://tcgmaster.com/sitemap.xml',
  };
}
