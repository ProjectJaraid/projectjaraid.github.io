<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
    
    <!-- Root Template -->
    <xsl:template match="/">
        <html>
            <head>
                <title>Type Attribute Report</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    h1 { text-align: center; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f4f4f4; }
                </style>
            </head>
            <body>
                <h1>Type Attributes in orgName Elements</h1>
                <table>
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Occurrences</th>
                            <th>Locations</th>
                        </tr>
                    </thead>
                    <tbody>
                        <xsl:for-each-group select="//orgName" group-by="@type">
                            <tr>
                                <td>
                                    <xsl:value-of select="current-grouping-key()" />
                                </td>
                                <td>
                                    <xsl:value-of select="count(current-group())" />
                                </td>
                                <td>
                                    <xsl:for-each select="current-group()">
                                        <xsl:if test="position() > 1">, </xsl:if>
                                        <a href="{document-uri(/)}">
                                            <xsl:value-of select="document-uri(/)" />
                                        </a>
                                    </xsl:for-each>
                                </td>
                            </tr>
                        </xsl:for-each-group>
                    </tbody>
                </table>
            </body>
        </html>
    </xsl:template>
    
</xsl:stylesheet>
