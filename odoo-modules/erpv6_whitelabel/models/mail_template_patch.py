# -*- coding: utf-8 -*-
from odoo import api, models


class MailTemplatePatch(models.AbstractModel):
    """Applica il rebranding ERPV6 ai template email core (auth_signup, portal).

    Questi record sono dichiarati `noupdate="1"` dai moduli core: un semplice
    <record> con lo stesso xmlid viene ignorato da Odoo durante un `-u` su un
    modulo già installato (solo un `-i` a modulo nuovo applicherebbe l'update
    dichiarativo). Un write() diretto via ORM, richiamato da <function> in
    data/mail_template_overrides.xml, bypassa quella protezione e funziona
    sia all'installazione che a ogni aggiornamento successivo.
    """
    _name = 'erpv6.whitelabel.mail_template_patch'
    _description = 'ERPV6 Whitelabel - Patch Template Email Core'

    @api.model
    def apply_erpv6_branding(self):
        overrides = {
            'auth_signup.set_password_email': {
                'subject': "{{ object.create_uid.name }} from {{ object.company_id.name }} invites you to connect to ERPV6",
                'body_html': """
<table border="0" cellpadding="0" cellspacing="0" style="padding-top: 16px; background-color: #FFFFFF; font-family:Verdana, Arial,sans-serif; color: #454748; width: 100%; border-collapse:separate;"><tr><td align="center">
<table border="0" cellpadding="0" cellspacing="0" width="590" style="padding: 16px; background-color: #FFFFFF; color: #454748; border-collapse:separate;">
<tbody>
    <!-- HEADER -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="middle">
                    <span style="font-size: 10px;">Welcome to ERPV6</span><br/>
                    <span style="font-size: 20px; font-weight: bold;">
                        <t t-out="object.name or ''">Marc Demo</t>
                    </span>
                </td><td valign="middle" align="right" t-if="not object.company_id.uses_default_logo">
                    <img t-attf-src="/logo.png?company={{ object.company_id.id }}" style="padding: 0px; margin: 0px; height: auto; width: 80px;" t-att-alt="object.company_id.name"/>
                </td></tr>
                <tr><td colspan="2" style="text-align:center;">
                  <hr width="100%" style="background-color:rgb(204,204,204);border:medium none;clear:both;display:block;font-size:0px;min-height:1px;line-height:0; margin: 16px 0px 16px 0px;"/>
                </td></tr>
            </table>
        </td>
    </tr>
    <!-- CONTENT -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="top" style="font-size: 13px;">
                    <div>
                        Dear <t t-out="object.name or ''">Marc Demo</t>,<br /><br />
                        You have been invited by <t t-out="object.create_uid.name or ''">OdooBot</t> of <t t-out="object.company_id.name or ''">YourCompany</t> to connect on ERPV6.
                        <div style="margin: 16px 0px 16px 0px;">
                            <a t-att-href="object.partner_id._get_signup_url()"
                                t-attf-style="background-color: {{object.company_id.email_secondary_color or '#875A7B'}}; padding: 8px 16px 8px 16px; text-decoration: none; color: #fff; border-radius: 5px; font-size:13px;">
                                Accept invitation
                            </a>
                        </div>
                        <b>  This link will remain valid during <t t-out="int(int(object.env['ir.config_parameter'].sudo().get_param('auth_signup.signup.validity.hours',144))/24)"></t> days </b> <br/>
                        <t t-set="website_url" t-value="object.get_base_url()"></t>
                        Your ERPV6 domain is: <b><a t-att-href='website_url' t-out="website_url or ''">http://yourcompany.odoo.com</a></b><br />
                        Your sign in email is: <b><a t-attf-href="/web/login?login={{ object.email }}" target="_blank" t-out="object.email or ''">mark.brown23@example.com</a></b><br /><br />
                        Never heard of ERPV6? It's an all-in-one business platform built on proven open-source technology. It will considerably improve your experience at work and increase your productivity.
                        <br /><br />
                        Have a look at the <a href="https://www.odoo.com/page/tour?utm_source=db&amp;utm_medium=auth" style="color: #875A7B;">Odoo Tour</a> to discover the tool.
                        <br /><br />
                        Enjoy ERPV6!<br />
                        --<br/>The <t t-out="object.company_id.name or ''">YourCompany</t> Team
                    </div>
                </td></tr>
                <tr><td style="text-align:center;">
                  <hr width="100%" style="background-color:rgb(204,204,204);border:medium none;clear:both;display:block;font-size:0px;min-height:1px;line-height:0; margin: 16px 0px 16px 0px;"/>
                </td></tr>
            </table>
        </td>
    </tr>
    <!-- FOOTER -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; font-size: 11px; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="middle" align="left">
                    <t t-out="object.company_id.name or ''">YourCompany</t>
                </td></tr>
                <tr><td valign="middle" align="left" style="opacity: 0.7;">
                    <t t-out="object.company_id.phone or ''">+1 650-123-4567</t>
                    <t t-if="object.company_id.email">
                        | <a t-att-href="'mailto:%s' % object.company_id.email" style="text-decoration:none; color: #454748;" t-out="object.company_id.email or ''">info@yourcompany.com</a>
                    </t>
                    <t t-if="object.company_id.website">
                        | <a t-att-href="'%s' % object.company_id.website" style="text-decoration:none; color: #454748;" t-out="object.company_id.website or ''">http://www.example.com</a>
                    </t>
                </td></tr>
            </table>
        </td>
    </tr>
</tbody>
</table>
</td></tr>
<!-- POWERED BY -->
<tr><td align="center" style="min-width: 590px;">
    <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: #F1F1F1; color: #454748; padding: 8px; border-collapse:separate;">
      <tr><td style="text-align: center; font-size: 13px;">
        Powered by <a target="_blank" href="https://www.odoo.com?utm_source=db&amp;utm_medium=auth" style="color: #875A7B;">ERPV6</a>
      </td></tr>
    </table>
</td></tr>
</table>""",
            },
            'auth_signup.mail_template_user_signup_account_created': {
                'body_html': """
<table border="0" cellpadding="0" cellspacing="0" style="padding-top: 16px; background-color: #FFFFFF; font-family:Verdana, Arial,sans-serif; color: #454748; width: 100%; border-collapse:separate;"><tr><td align="center">
<table border="0" cellpadding="0" cellspacing="0" width="590" style="padding: 16px; background-color: #FFFFFF; color: #454748; border-collapse:separate;">
<tbody>
    <!-- HEADER -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="middle">
                    <span style="font-size: 10px;">Your Account</span><br/>
                    <span style="font-size: 20px; font-weight: bold;">
                        <t t-out="object.name or ''">Marc Demo</t>
                    </span>
                </td><td valign="middle" align="right" t-if="not object.company_id.uses_default_logo">
                    <img t-attf-src="/logo.png?company={{ object.company_id.id }}" style="padding: 0px; margin: 0px; height: auto; width: 80px;" t-att-alt="object.company_id.name"/>
                </td></tr>
                <tr><td colspan="2" style="text-align:center;">
                  <hr width="100%" style="background-color:rgb(204,204,204);border:medium none;clear:both;display:block;font-size:0px;min-height:1px;line-height:0; margin: 16px 0px 16px 0px;"/>
                </td></tr>
            </table>
        </td>
    </tr>
    <!-- CONTENT -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="top" style="font-size: 13px;">
                    <div>
                        Dear <t t-out="object.name or ''">Marc Demo</t>,<br/><br/>
                        Your account has been successfully created!<br/>
                        Your login is <strong><t t-out="object.email or ''">mark.brown23@example.com</t></strong><br/>
                        To gain access to your account, you can use the following link:
                        <div style="margin: 16px 0px 16px 0px;">
                            <a t-attf-href="/web/login?auth_login={{object.email}}"
                                style="background-color: #875A7B; padding: 8px 16px 8px 16px; text-decoration: none; color: #fff; border-radius: 5px; font-size:13px;">
                                Go to My Account
                            </a>
                        </div>
                        Thanks,<br/>
                        <t t-if="user.signature">
                            <br/>
                            <t t-out="user.signature or ''">--<br/>Mitchell Admin</t>
                        </t>
                    </div>
                </td></tr>
                <tr><td style="text-align:center;">
                  <hr width="100%" style="background-color:rgb(204,204,204);border:medium none;clear:both;display:block;font-size:0px;min-height:1px;line-height:0; margin: 16px 0px 16px 0px;"/>
                </td></tr>
            </table>
        </td>
    </tr>
    <!-- FOOTER -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; font-size: 11px; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="middle" align="left">
                    <t t-out="object.company_id.name or ''">YourCompany</t>
                </td></tr>
                <tr><td valign="middle" align="left" style="opacity: 0.7;">
                    <t t-out="object.company_id.phone or ''">+1 650-123-4567</t>
                    <t t-if="object.company_id.email">
                        | <a t-attf-href="mailto:{{object.company_id.email}}" style="text-decoration:none; color: #454748;" t-out="object.company_id.email or ''">info@yourcompany.com</a>
                    </t>
                    <t t-if="object.company_id.website">
                        | <a t-att-href="object.company_id.website" style="text-decoration:none; color: #454748;" t-out="object.company_id.website or ''">http://www.example.com</a>
                    </t>
                </td></tr>
            </table>
        </td>
    </tr>
</tbody>
</table>
</td></tr>
<!-- POWERED BY -->
<tr><td align="center" style="min-width: 590px;">
    <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: #F1F1F1; color: #454748; padding: 8px; border-collapse:separate;">
      <tr><td style="text-align: center; font-size: 13px;">
        Powered by <a target="_blank" href="https://www.odoo.com?utm_source=db&amp;utm_medium=auth" style="color: #875A7B;">ERPV6</a>
      </td></tr>
    </table>
</td></tr>
</table>""",
            },
            'portal.mail_template_data_portal_welcome': {
                'body_html': """
            <!-- defaulting to the partner as fallback for preview wizard (used when user hasn't been created yet) -->
            <t t-set="user_name" t-value="object.user_id.name or object.partner_id.name or ''"/>
            <t t-set="company_name" t-value="object.user_id.company_id.name or object.partner_id.company_id.name or ''"/>
            <t t-set="signup_url" t-value="object.user_id.partner_id and object.user_id.partner_id._get_signup_url() or object.partner_id and object.partner_id._get_signup_url()"/>
<table border="0" cellpadding="0" cellspacing="0" style="padding-top: 16px; background-color: #F1F1F1; font-family:Verdana, Arial,sans-serif; color: #454748; width: 100%; border-collapse:separate;"><tr><td align="center">
<table border="0" cellpadding="0" cellspacing="0" width="590" style="padding: 16px; background-color: white; color: #454748; border-collapse:separate;">
<tbody>
    <!-- HEADER -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="middle">
                    <span style="font-size: 10px;">Your Account</span><br/>
                    <span style="font-size: 20px; font-weight: bold;" t-out="user_name">Marc Demo</span>
                </td><td valign="middle" align="right" t-if="not object.user_id.company_id.uses_default_logo">
                    <img t-attf-src="/logo.png?company={{ object.user_id.company_id.id }}" style="padding: 0px; margin: 0px; height: auto; width: 80px;" t-att-alt="object.user_id.company_id.name"/>
                </td></tr>
                <tr><td colspan="2" style="text-align:center;">
                  <hr width="100%" style="background-color:rgb(204,204,204);border:medium none;clear:both;display:block;font-size:0px;min-height:1px;line-height:0; margin:16px 0px 16px 0px;"/>
                </td></tr>
            </table>
        </td>
    </tr>
    <!-- CONTENT -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="top" style="font-size: 13px;">
                    <div>
                        Dear <t t-out="user_name">Marc Demo</t>,<br/> <br/>
                        Welcome to <t t-out="company_name">YourCompany</t>'s Portal!<br/><br/>
                        An account has been created for you with the following login: <t t-out="object.user_id.login">demo</t><br/><br/>
                        Click on the button below to pick a password and activate your account.
                        <div style="margin: 16px 0px 16px 0px; text-align: center;">
                            <a t-att-href="signup_url" style="display: inline-block; padding: 10px; text-decoration: none; font-size: 12px; background-color: #875A7B; color: #fff; border-radius: 5px;">
                                <strong>Activate Account</strong>
                            </a>
                        </div>
                        <t t-out="object.wizard_id.welcome_message or ''">Welcome to our company's portal.</t>
                    </div>
                </td></tr>
                <tr><td style="text-align:center;">
                  <hr width="100%" style="background-color:rgb(204,204,204);border:medium none;clear:both;display:block;font-size:0px;min-height:1px;line-height:0; margin: 16px 0px 16px 0px;"/>
                </td></tr>
            </table>
        </td>
    </tr>
    <!-- FOOTER -->
    <tr>
        <td align="center" style="min-width: 590px;">
            <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: white; font-size: 11px; padding: 0px 8px 0px 8px; border-collapse:separate;">
                <tr><td valign="middle" align="left">
                    <t t-out="company_name">YourCompany</t>
                </td></tr>
                <tr><td valign="middle" align="left" style="opacity: 0.7;">
                    <t t-out="object.user_id.company_id.phone or ''">+1 650-123-4567</t>
                    <t t-if="object.user_id.company_id.email">
                        | <a t-attf-href="'mailto:%s' % {{ object.user_id.company_id.email }}" style="text-decoration:none; color: #454748;" t-out="object.user_id.company_id.email or ''">info@yourcompany.com</a>
                    </t>
                    <t t-if="object.user_id.company_id.website">
                        | <a t-attf-href="'%s' % {{ object.user_id.company_id.website }}" style="text-decoration:none; color: #454748;" t-out="object.user_id.company_id.website or ''">http://www.example.com</a>
                    </t>
                </td></tr>
            </table>
        </td>
    </tr>
</tbody>
</table>
</td></tr>
<!-- POWERED BY -->
<tr><td align="center" style="min-width: 590px;">
    <table border="0" cellpadding="0" cellspacing="0" width="590" style="min-width: 590px; background-color: #F1F1F1; color: #454748; padding: 8px; border-collapse:separate;">
      <tr><td style="text-align: center; font-size: 13px;">
        Powered by <a target="_blank" href="https://www.odoo.com?utm_source=db&amp;utm_medium=portalinvite" style="color: #875A7B;">ERPV6</a>
      </td></tr>
    </table>
</td></tr>
</table>""",
            },
        }
        for xmlid, vals in overrides.items():
            record = self.env.ref(xmlid, raise_if_not_found=False)
            if record:
                record.write(vals)
